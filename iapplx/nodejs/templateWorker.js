'use strict';

const yaml = require('js-yaml');

const mystique = require('mystique');

const FsSchemaProvider = mystique.FsSchemaProvider;
const FsTemplateProvider = mystique.FsTemplateProvider;
const httpUtils = mystique.httpUtils;
const AS3Driver = mystique.AS3Driver;

const projectName = 'f5-mystique';

const configPath = process.AFL_TW_ROOT || `/var/config/rest/iapps/${projectName}`;
const templatesPath = `${configPath}/templates`;
const schemasPath = `${configPath}/schemas`;

class TemplateWorker {
    constructor() {
        this.state = {};

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${projectName}`;
        this.schemaProvider = new FsSchemaProvider(schemasPath);
        this.templateProvider = new FsTemplateProvider(templatesPath, this.schemaProvider);
        this.driver = new AS3Driver();
    }

    /**
     * Worker Handlers
     */
    onStartCompleted(success, error, state, errMsg) {
        if (errMsg) {
            this.logger.severe(`TemplateWorker onStartCompleted error: something went wrong ${errMsg}`);
            error();
        }
        this.setLxBlockStatus(projectName)
            .then(() => {
                this.logger.fine(`TemplateWorker state loaded: ${JSON.stringify(state)}`);
                success();
            })
            .catch((err) => {
                error(err);
            });
    }

    // LX block status controls the ball color shown in the BIG-IP UI.
    // When at least one mustache app is deployed, set state to BOUND (green).
    // When all are deleted, set state to UNBOUND (gray).
    setLxBlockStatus(blockName, state) {
        const blockData = {
            name: blockName,
            state: state || 'UNBOUND',
            configurationProcessorReference: {
                link: 'https://localhost/mgmt/shared/iapp/processors/noop'
            },
            presentationHtmlReference: {
                link: `https://localhost/iapps/${projectName}/index.html`
            }
        };

        return httpUtils.makeGet('/shared/iapp/blocks')
            .then((res) => {
                if (res.status === 200) {
                    const body = res.body;
                    let noBlockFound = true;
                    body.items.forEach((block) => {
                        if (block.name === blockName) {
                            noBlockFound = false;
                            if (state !== undefined && state !== block.state) {
                                httpUtils.makePatch(`/shared/iapp/blocks/${block.id}`, {
                                    state,
                                    presentationHtmlReference: blockData.presentationHtmlReference
                                });
                            }
                        }
                    });
                    if (noBlockFound) {
                        httpUtils.makePost('/shared/iapp/blocks', blockData);
                    }
                }
            });
    }

    /**
     * HTTP/REST handlers
     */
    genRestResponse(restOperation, code, message) {
        restOperation.setBody({
            code,
            message
        });
        this.completeRestOperation(restOperation);
        return Promise.resolve();
    }

    getTemplates(restOperation, tmplid) {
        if (tmplid) {
            return this.templateProvider.fetch(tmplid)
                .then((tmpl) => {
                    tmpl.title = tmpl.title || tmplid;
                    restOperation.setHeaders('Content-Type', 'text/json');
                    restOperation.setBody(tmpl);
                    this.completeRestOperation(restOperation);
                }).catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return this.templateProvider.list()
            .then((templates) => {
                restOperation.setBody(templates);
                this.completeRestOperation(restOperation);
            });
    }

    getApplications(restOperation, appid) {
        if (appid) {
            const uri = restOperation.getUri();
            const pathElements = uri.path.split('/');
            const tenant = pathElements[4];
            const app = pathElements[5];
            return this.driver.getApplication(tenant, app)
                .then((appDef) => {
                    restOperation.setHeaders('Content-Type', 'text/json');
                    restOperation.setBody(appDef);
                    this.completeRestOperation(restOperation);
                })
                .catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return this.driver.listApplications()
            .then((appsList) => {
                restOperation.setBody(appsList);
                this.completeRestOperation(restOperation);
            });
    }

    onGet(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];
        try {
            switch (collection) {
            case 'info':
                return this.genRestResponse(restOperation, 200, '');
            case 'templates':
                return this.getTemplates(restOperation, itemid);
            case 'applications':
                return this.getApplications(restOperation, itemid);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.statck);
        }
    }

    postApplications(restOperation, data) {
        const tmplid = data.name;
        const tmplView = data.parameters;
        const metadata = {
            template: tmplid,
            view: tmplView
        };
        return this.templateProvider.fetch(tmplid)
            .then(tmpl => yaml.safeLoad(tmpl.render(tmplView)))
            .then(declaration => this.driver.createApplication(declaration, metadata))
            .then((response) => {
                if (response.status >= 300) {
                    return this.genRestResponse(restOperation, response.status, response.body);
                }
                return this.genRestResponse(restOperation, response.status, {
                    id: response.body.id,
                    name: tmplid,
                    parameters: tmplView
                });
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    onPost(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];

        try {
            switch (collection) {
            case 'applications':
                return this.postApplications(restOperation, body);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, `${e.message}\n${restOperation.getBody()}`);
        }
    }

    deleteApplications(restOperation, appid) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const tenant = pathElements[4];
        const app = pathElements[5];

        if (!appid) {
            return this.genRestResponse(restOperation, 405, 'DELETE is only supported for individual applications');
        }

        return this.driver.deleteApplication(tenant, app)
            .then((result) => {
                restOperation.setHeaders('Content-Type', 'text/json');
                restOperation.setBody(result);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 404, e.stack));
    }

    onDelete(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];

        try {
            switch (collection) {
            case 'applications':
                return this.deleteApplications(restOperation, itemid);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, `${e.message}\n${restOperation.getBody()}`);
        }
    }
}

module.exports = TemplateWorker;
