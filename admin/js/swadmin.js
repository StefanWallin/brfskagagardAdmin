/* global jStorage */
(function (w, undefined) {
    "use strict";

    var StaticWebDefinition = w.StaticWebDefinition || function () {
        if (!(this instanceof StaticWebDefinition)) {
            return new StaticWebDefinition();
        }
        this.init();
    }
    StaticWebDefinition.prototype.init = function () {
        var self = this;

        this.config = {};
        this.cookieName = 'staticweb-token';
        // all loaded components should store themself here.
        this.components = {};
        this.elements = {};

        this.storage = false;

        var token = this.getToken();
        // Do we have a valid token?
        if (token) {
            this.loadAdminState(token);
        } else if (this.inAdminPath()) {
            var button = document.getElementById('staticweb-login-btn')
            button.addEventListener('click', function () {
                var input = document.getElementById('staticweb-login-token');
                var token = self.sanitizeToken(input.value);
                if (token) {
                    self.loadAdminState(token);
                } else {
                    alert('Ogiltigt personligt åtkomsttoken.');
                }
            });
        }
    }

    StaticWebDefinition.prototype.includeStyle = function (addr) {
        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = addr;
        var s = document.getElementsByTagName('head')[0];
        s.appendChild(link, s);
    }

    StaticWebDefinition.prototype.loadAdminState = function (token) {
        var self = this;
        var adminPath = this.getAdminPath();
        this.loadComponents();

        this.includeStyle(adminPath + 'css/swadmin.css');
        this.includeScript(adminPath + 'js/jStorage.js');
        this.includeScript(adminPath + 'js/swconfig.js');
        self.ensureLoaded('storage', self.config, function () {
            self.ensureLoaded('jStorage', window, function () {
                self.includeScript(adminPath + 'js/jStorage.' + self.config.storage.type + '.js');
                self.ensureLoaded(self.config.storage.type, jStorage.providers, function () {
                    self.storage = jStorage({
                        'name': self.config.storage.type,
                        'repo': self.config.storage.repo,
                        'token': token,
                        'callback': function (storage, callStatus) {
                            if (callStatus.isOK) {
                                self.writeCookie(self.cookieName, token);

                                if (self.inAdminPath()) {
                                    self.showNavigation();
                                    self.removeLogin();
                                } else {
                                    self.loadOnPage();
                                }
                                self.config.storage.isReady = true;
                            } else {
                                alert('Ogiltigt personligt åtkomsttoken.');
                                self.writeCookie(self.cookieName, '');
                                location.reload();
                            }
                        }
                    });
                });
            });
        });
    }
    StaticWebDefinition.prototype.addResource = function (resourceName, data) {
        // TODO: queue requests that are done until we have a valid storage
        this.storage.set(resourceName, data, function (fileMeta, callStatus) {
            if (callStatus.isOK) {
                alert('saved');
            } else {
                alert('fail, error code: 1');
            }
        });
    }
    StaticWebDefinition.prototype.updateResource = function (resourceName, data) {
        // TODO: queue requests that are done until we have a valid storage
        // NOTE: We can only update file if we have previously called getResource....
        this.storage.set(resourceName, data, function (fileMeta, callStatus) {
            if (callStatus.isOK) {
                alert('saved');
            } else {
                alert('failed to update, please wait a minute and try again.');
            }
        });
    }
    StaticWebDefinition.prototype.updateCurrentPage = function () {
        var resourceName = location.pathname.substring(1);
        if (resourceName.length == 0) {
            resourceName = "index.html";
        }
        if (resourceName[resourceName.length - 1] === '/') {
            resourceName = resourceName + "index.html";
        }
        this.updatePage(resourceName);
    }
    StaticWebDefinition.prototype.updatePage = function (containerId, containerTagName, resourceName, content) {
        var self = this;

        content = this.encodeToHtml(content);
        content = content.replace(regexp, '');

        // Disallowed chars regex
        var regexp = /([^a-z0-9!{}<>/\;&#\:\ \=\\r\\n\\t\"\'\%\*\-\.\,\(\)\@])/gi;

        self.storage.get(resourceName, function (file, callStatus) {
            if (callStatus.isOK) {
                var data = file.data;
                data = data ? data.replace(regexp, '') : '';

                var index = data.indexOf('id="' + containerId + '"');
                index = data.indexOf('>', index);
                index++;

                var tagName = containerTagName.toLowerCase();
                var tmp = data.substring(index);

                var endIndex = 0;
                var startIndex = 0;
                var tagsInMemory = 0;

                var found = false;
                var insanityIndex = 0;
                while (!found && insanityIndex < 10000) {
                    insanityIndex++;
                    endIndex = tmp.indexOf('</' + tagName, endIndex);
                    startIndex = tmp.indexOf('<' + tagName, startIndex);

                    if (startIndex == -1) {
                        // we have not found a start tag of same type so we have found our end tag.
                        if (tagsInMemory == 0) {
                            tmp = tmp.substring(0, endIndex);
                            found = true;
                        } else {
                            tagsInMemory--;
                            endIndex += tagName.length + 2;
                            startIndex = endIndex;
                        }
                    } else if (endIndex < startIndex) {
                        // start tag was found after our end tag so we have found our end tag.
                        if (tagsInMemory == 0) {
                            tmp = tmp.substring(0, endIndex);
                            found = true;
                        } else {
                            tagsInMemory--;
                            endIndex += tagName.length + 2;
                            startIndex = endIndex;
                        }
                    } else {
                        tagsInMemory++;
                        startIndex += tagName.length + 1;
                        endIndex = startIndex;
                    }
                }

                tmp = tmp.substring(0, endIndex);

                if (data.indexOf(tmp) >= 0) {
                    // We have not reproduced same start content, now, replace it :)
                    var newData = data.replace(tmp, content);
                    if (newData.indexOf('<meta name="generator" content="StaticWeb" />') == -1) {
                        newData = newData.replace('</head>', '<meta name="generator" content="StaticWeb" /></head>');
                    }

                    self.updateResource(resourceName, newData);
                } else {
                    alert('Could not update page, no matching content');
                }
            }
        })
    }
    StaticWebDefinition.prototype.loadOnPage = function () {
        var self = this;
        var adminPath = self.getAdminPath();

        if (this.config.onPage && this.config.onPage.use) {
                this.includeScript(adminPath + 'js/swonpage.js');
        }
    }
    StaticWebDefinition.prototype.loadComponents = function () {
        var self = this;
        var adminPath = self.getAdminPath();

        // Find elements that should be created as components
        var elements = document.getElementsByClassName('staticweb-component');
        for (var index = 0; index < elements.length; index++) {
            var element = elements[index];
            var attr = element.attributes['data-staticweb-component'];
            if (attr) {
                // If this is the first component of this type, create array
                if (!self.elements[attr.value]) {
                    self.elements[attr.value] = [];
                }
                // add element to known elements for type
                self.elements[attr.value].push(element);
            }
        }

        // Load all components we have found
        // We are waiting until we have gone through all elements because there can be multiple elements of same component type
        // and we want to be sure self.elements contains all of our types when component is loaded )
        for (var key in self.elements) {
            if (self.elements.hasOwnProperty(key)) {
                self.includeScript(adminPath + 'js/components/' + key + '.js');
            }
        }
    }
    StaticWebDefinition.prototype.writeCookie = function (name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toGMTString();
        }
        document.cookie = name + "=" + value + expires + "; path=/";
    }
    StaticWebDefinition.prototype.ensureLoaded = function (name, container, callback) {
        var self = this;
        setTimeout(function () {
            if (name in container) {
                callback();
            } else {
                self.ensureLoaded(name, container, callback);
            }
        }, 100);
    }
    StaticWebDefinition.prototype.sanitizeToken = function (token) {
        var regexp = /([^a-z0-9])/gi;
        token = token ? token.replace(regexp, '') : '';
        return token;
    }
    StaticWebDefinition.prototype.encodeToHtml = function (data) {
        var toHtmlCode = function (char) { return '&#' + char.charCodeAt('0') + ';'; };
        return data.replace(/([^a-z0-9!{}<>/\;&#\:\ \=\\r\\n\\t\"\'\%\*\-\.\,\(\)\@])/gi, toHtmlCode);
    }
    StaticWebDefinition.prototype.getToken = function () {
        var token = this.readCookie(this.cookieName);
        return this.sanitizeToken(token);
    }

    StaticWebDefinition.prototype.showNavigation = function () {
        var nav = document.getElementsByClassName('navigation')[0];
        nav.style.display = "block";
    }

    StaticWebDefinition.prototype.removeLogin = function () {
        var mood = document.getElementsByClassName('mood')[0];
        mood.className = "mood";

        var callToAction = document.getElementsByClassName('call-to-action')[0];
        callToAction.remove();
    }

    w.StaticWebDefinition = StaticWebDefinition;
    w.StaticWeb = StaticWebDefinition();
})(window);
