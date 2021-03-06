// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
console.log("starting ionic");
angular.module('agentapp', ['ionic', "angular-hal", "agentapp.controllers"])
    .config(function($httpProvider) {
        $httpProvider.defaults.withCredentials = true;
    })
    .config(function($stateProvider, $urlRouterProvider) {
        console.log("configuring router");
        $urlRouterProvider.otherwise("tickets");
        console.log("configuring routes");
        $stateProvider
            .state("login", {
                url:"/login",
                templateUrl:"templates/login.html",
                controller:"LoginCtrl",
                public: true
            })
            .state("tickets", {
                url:"/tickets",
                templateUrl:"templates/tickets.html",
                controller:"TicketCtrl",
                cache:false
            })
            .state("tickets.detail", {
                url:"/:ticketId",
                templateUrl:"templates/ticket.html",
                controller:"TicketDetailCtrl"
            })
            .state("new_ticket", {
                url:"/new_ticket",
                templateUrl:"templates/new_ticket.html",
                controller:"NewTicketCtrl"
            })
            .state("help", {
                url:"/help",
                template:"<ion-view view-title='Help'><ion-content has-headers='true'><h1>Help</h1><p>Please help yourself</p></ion-content></ion-view>",
                public: true
            });
    })
    .factory("UserInfo", function($localStorage) {

        console.log("creating UserInfo service");
        var userData = $localStorage.getObject("user_data") || {};
        var token = $localStorage.get("user_token") || null;
        return {
            isLoggedIn: function() {
                return this.getToken() != null;
            },
            getUserData: function() {
                return angular.extend({}, userData);
            },
            setUserData: function(data) {
                userData = angular.extend(userData, data);
                $localStorage.setObject("user_data", userData);
            },
            getToken: function() {
                return token;
            },
            setToken: function(tk) {
                token = tk;
                $localStorage.set("user_token", tk);
            }
        };
    })
    .factory("TicketInfo", function() {
        var ticketData = {};
        return {
            getTicketData: function() {
                return angular.extend({}, ticketData);
            },
            setTicketData: function(data) {
                userData = angular.extend(ticketData, data);
            }
        };
    })
    .factory('$localStorage', ['$window', function($window) {
        return {
            set: function(key, value) {
                $window.localStorage[key] = value;
            },
            get: function(key, defaultValue) {
                return $window.localStorage[key] || defaultValue;
            },
            setObject: function(key, value) {
                $window.localStorage[key] = JSON.stringify(value);
            },
            getObject: function(key) {
                return JSON.parse($window.localStorage[key] || '{}');
            }
        };
    }])
    .factory('RESTService', function(halClient, UserInfo, $localStorage) {
        console.log("creating rest service");
        var stored_root = $localStorage.get("server_url") || "http://10.141.2.157:6543";
        
        
        var root = halClient.$get(stored_root + "/api/v2");
        return  {
            "url": stored_root,
            "set_url": function(new_root) {
                this.url = new_root;
                $localStorage.set("server_url", new_root);
                root = halClient.$get(new_root + "/api/v2");
                return root;
            },
            "start": function() {
                return root;
            },
            'login' : function(username, password) {
                console.error("Logging in with:", username, password);
                return root.then(function(resource) {
                    return resource.$get("uly:app").then(function(app) {
                        return app.$post("uly:signin", {
                                "username":username,
                                "password":password,
                                "source": "token"
                        });
                    }).then(function(login) {
                        console.log("got login:", login);
                        if (login.token) {
                            UserInfo.setToken(login.token);
                        }
                        return login.$get("uly:app");
                    });
                });
            },
            'load' : function() {
                return root.then(function(resource) {
                    return resource.$get("uly:data");
                })
                    .then(function(data) {
                        var currentUser = UserInfo.getUserData();
                        var uid = currentUser.id;
                        var filter = "(assignee_id='"+uid+"')";
                        return data.$get("uly:ticket", {"embed":1, "filters":filter });
                    });
            },
            'new_ticket' : function(title, body) {
                console.error("Creating new ticket in with:", title, body);
                return root.then(function(resource) {
                    return resource.$get("uly:data").then(function(data) {
                        console.log("got data:", data);
                        return data.$post("uly:ticket", {}, { "description":title, "body":body});
                    });
                });
            },
            loadTicket: function(id) {
                return root.then(function(resource) {
                    return resource.$get("uly:data");
                })
                    .then(function(data) {
                        return data.$get("find", {"rel":"ticket/"+id});
                    });
            }
            
        };
    })
    .factory('httpRequestInterceptor', function (UserInfo) {
        return {
            request: function (config) {
                var token = UserInfo.getToken();
                if (token) {
                    config.headers = angular.extend(config.headers || {}, {
                        'Authorization':'Bearer ' + token
                    });
                }
                console.log("setting headers:", config.headers, "with token", token);
                // use this to prevent destroying other existing headers
                // config.headers['Authorization'] = 'authentication;

                return config;
            },
            response: function(response) {
                //check the X-Ulysses-Token header
                console.log("Got headers:", response.headers(), response.headers("X-Ulysses-Token"));
                token = response.headers()["X-Ulysses-Token"];
                if(token) {
                    console.log("set token to:", token);
                    UserInfo.setToken(token);
                }
                return response;
            }
        };
    })
    .config(function($httpProvider) {
        $httpProvider.interceptors.push('httpRequestInterceptor');
    })
    .run(function($ionicPlatform, $rootScope, $location, UserInfo, $state) {
        $ionicPlatform.ready(function() {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if(window.cordova && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            }
            if(window.StatusBar) {
                StatusBar.styleDefault();
            }
        });
        console.log("running");
        $rootScope.$on('$stateChangeStart', function (ev, next, nextparams, curr, currparams) {
            console.log("next:", next, next && next.public);
            if (next && !next.public) {
                var user = UserInfo.getUserData();
                console.log("got user:", user);
                if (!(user && user.fullname))  {
                    ev.preventDefault();
                    $state.go("login");
                }
            }
        });
        
    });
