/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'templates/bigip-fast-templates/tcp.yaml';

/*
TMSH GENERATED BY THE TCP IAPP
ltm virtual tcp123.app/tcp123_vs_tcp123_vs_10.4.4.22 {
    app-service /Common/tcp123.app/tcp123
    destination 10.4.4.22:tproxy
    fw-enforced-policy tcp123.app/tcp123_firewall
    ip-intelligence-policy tcp123.app/tcp123_ip_intelligence
    ip-protocol tcp
    mask 255.255.255.255
    persist {
        tcp123.app/tcp123_source-addr_persistence {
            default yes
        }
    }
    pool tcp123.app/tcp123_pool
    profiles {
        tcp123.app/tcp123_fastl4 { }
    }
    security-log-profiles {
        global-network
    }
    source 0.0.0.0/0
    source-address-translation {
        pool tcp123.app/tcp123_snatpool
        type snat
    }
    translate-address enabled
    translate-port enabled
    vlans {
        external
    }
    vlans-enabled
    vs-index 20
}
security firewall policy tcp123.app/tcp123_firewall {
    app-service /Common/tcp123.app/tcp123
    rules {
        acceptPackets {
            action accept
            app-service /Common/tcp123.app/tcp123
            ip-protocol tcp
            source {
                addresses {
                    192.169.24.0-192.169.24.100 {
                        app-service /Common/tcp123.app/tcp123
                    }
                }
            }
        }
        dropPackets {
            action drop
            app-service /Common/tcp123.app/tcp123
            ip-protocol tcp
            log yes
            source {
                addresses {
                    0.0.0.0/0 {
                        app-service /Common/tcp123.app/tcp123
                    }
                }
            }
        }
    }
}
security ip-intelligence policy tcp123.app/tcp123_ip_intelligence {
    app-service /Common/tcp123.app/tcp123
    blacklist-categories {
        botnets {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        cloud_provider_networks {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        denial_of_service {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        infected_sources {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        mobile_threats {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        phishing {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        proxy {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        scanners {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        spam_sources {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        tor_proxy {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        web_attacks {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
        windows_exploits {
            app-service /Common/tcp123.app/tcp123
            match-direction-override match-source
        }
    }
    default-log-blacklist-hit-only yes
}
ltm pool tcp123.app/tcp123_pool {
    app-service /Common/tcp123.app/tcp123
    load-balancing-mode least-connections-member
    members {
        10.0.0.12:us-cli {
            address 10.0.0.12
            app-service /Common/tcp123.app/tcp123
            connection-limit 200
            priority-group 2
            session monitor-enabled
            state down
        }
        10.0.0.13:us-srv {
            address 10.0.0.13
            app-service /Common/tcp123.app/tcp123
            connection-limit 300
            priority-group 3
            session monitor-enabled
            state down
        }
    }
    monitor tcp123.app/tcp123_tcp_monitor
    slow-ramp-time 150
}
ltm monitor tcp tcp123.app/tcp123_tcp_monitor {
    adaptive disabled
    app-service /Common/tcp123.app/tcp123
    defaults-from tcp
    destination *:*
    interval 17
    ip-dscp 0
    recv expect_test_response
    recv-disable none
    send send_test_string
    time-until-up 0
    timeout 52
}
ltm profile fastl4 tcp123.app/tcp123_fastl4 {
    app-service /Common/tcp123.app/tcp123
    defaults-from fastL4
}
*/

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,
    hostnames: ['www.example.com'],

    // pool spec
    enable_pool: true,
    make_pool: true,
    pool_members: ['10.2.1.1', '10.2.1.2'],
    pool_port: 4444,
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 300,

    // snat
    enable_snat: true,
    snat_automap: false,
    snat_addresses: ['10.3.1.1', '10.3.1.2'],

    // persistence
    enable_persistence: true,
    persistence_type: 'source-address',
    enable_fallback_persistence: false,

    // irule
    irule_names: ['example_irule'],

    // firewall
    enable_firewall: true,
    firewall_allow_list: ['10.0.0.0/8', '11.0.0.0/8'],
    log_profile_names: ['log local']
};

const expected = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'urn:uuid:a858e55e-bbe6-42ce-a9b9-0f4ab33e3bf7',
    t1: {
        class: 'Tenant',
        app1: {
            class: 'Application',
            template: 'generic',
            app1: {
                class: 'Service_TCP',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                pool: 'app1_pool',
                snat: {
                    use: 'app1_snatpool'
                },
                persistenceMethods: ['source-address'],
                profileTCP: {
                    ingress: 'wan',
                    egress: 'lan'
                },
                iRules: [
                    {
                        bigip: 'example_irule'
                    }
                ],
                policyFirewallEnforced: {
                    use: 'app1_fw_policy'
                },
                securityLogProfiles: [
                    {
                        bigip: 'log local'
                    }
                ]
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    serverAddresses: ['10.2.1.1', '10.2.1.2'],
                    servicePort: 4444,
                    shareNodes: true
                }],
                loadBalancingMode: view.load_balancing_mode,
                slowRampTime: 300,
                monitors: ['tcp']
            },
            app1_snatpool: {
                class: 'SNAT_Pool',
                snatAddresses: view.snat_addresses
            },
            app1_fw_allow_list: {
                class: 'Firewall_Address_List',
                addresses: [
                    '10.0.0.0/8',
                    '11.0.0.0/8'
                ]
            },
            default_fw_deny_list: {
                class: 'Firewall_Address_List',
                addresses: ['0.0.0.0/0']
            },
            app1_fw_rules: {
                class: 'Firewall_Rule_List',
                rules: [
                    {
                        protocol: 'tcp',
                        name: 'acceptTcpPackets',
                        loggingEnabled: true,
                        source: {
                            addressLists: [
                                {
                                    use: 'app1_fw_allow_list'
                                }
                            ]
                        },
                        action: 'accept'
                    },
                    {
                        protocol: 'any',
                        name: 'dropPackets',
                        loggingEnabled: true,
                        source: {
                            addressLists: [
                                {
                                    use: 'default_fw_deny_list'
                                }
                            ]
                        },
                        action: 'drop'
                    }
                ]
            },
            app1_fw_policy: {
                class: 'Firewall_Policy',
                rules: [
                    {
                        use: 'app1_fw_rules'
                    }
                ]
            }
        }
    }
};

describe(template, function () {
    describe('new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('default pool port, existing monitor, snatpool, and profiles', function () {
        before(() => {
            // default https pool port and existing monitor
            console.log(JSON.stringify(view.pool_members));
            view.pool_port = 80;
            expected.t1.app1.app1_pool.members[0].servicePort = 80;
            view.make_monitor = false;
            view.monitor_name = '/Common/monitor1';
            expected.t1.app1.app1_pool.monitors = [{ bigip: '/Common/monitor1' }];
        });
        util.assertRendering(template, view, expected);
    });

    describe('existing pool, snat automap and default profiles', function () {
        before(() => {
            // default https virtual port
            delete view.virtual_port;
            expected.t1.app1.app1.virtualPort = 443;

            // existing pool
            delete view.pool_members;
            view.make_pool = false;
            view.pool_name = '/Common/pool1';
            delete expected.t1.app1.app1_pool;
            expected.t1.app1.app1.pool = { bigip: '/Common/pool1' };

            // snat automap
            view.snat_automap = true;
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.app1.snat = 'auto';
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});