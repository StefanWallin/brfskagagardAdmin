(function () {
    //var cookieName = 'staticweb-token';
    var cookieName = 'token';
    var loginPages = { '/admin/': true, '/admin/index.html': true };

    var storage = false;
    var self = this;

    function writeCookie(name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        }
        else var expires = "";
        document.cookie = name + "=" + value + expires + "; path=/";
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function includeScript(addr) {
        var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
        ga.src = addr;
        var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
    }

    function showNavigation() {
        var nav = document.getElementsByClassName('navigation')[0];
        nav.style.display = "block";
    }

    function removeLogin() {
        var mood = document.getElementsByClassName('mood')[0];
        mood.className = "mood";

        var callToAction = document.getElementsByClassName('call-to-action')[0];
        callToAction.remove();
    }

    function sanitizeToken(token) {
        var regexp = /([^a-z0-9])/gi;
        token = token ? token.replace(regexp, '') : '';
        return token;
    }

    function getToken() {
        var token = readCookie(cookieName);
        return sanitizeToken(token);
    }

    function ensureLoaded(name, container, callback) {
        setTimeout(function () {
            if (name in container) {
                callback();
            } else {
                ensureLoaded(name, container, callback);
            }
        }, 100);
    }

    function loadAdminState(token) {
        includeScript('./js/jStorage.js');

        ensureLoaded('jStorage', window, function () {
            includeScript('./js/jStorage.github.js');
            ensureLoaded('github', jStorage.providers, function () {
                self.storage = jStorage({
                    'name': 'github',
                    'repo': 'flowertwig-org/brfskagagardAdmin',
                    'token': token,
                    'callback': function (storage, callStatus) {
                        if (callStatus.isOK) {
                            writeCookie(cookieName, token);

                            if (location.pathname in loginPages) {
                                showNavigation();
                                removeLogin();
                            }
                            storage.get('parking-test.html', function (file, callStatus) {
                                storage.get('parking.html', function (file, callStatus) {
                                    if (callStatus.isOK) {
                                        //alert('file loaded: \r\n' + file.data);
                                        var data = file.data;
                                        var regexp = /([^a-z0-9!{}<>/\;&#\:\ \=\\r\\n\\t\"\'\%\*\-\.\(\)])/gi;
                                        data = data ? data.replace(regexp, '') : '';
                                        storage.set('parking-test.html', data, function (fileMeta, callStatus) {
                                            if (callStatus.isOK) {
                                                alert('done');
                                            } else {
                                                alert('fail');
                                            }
                                        });
                                    }
                                });
                            });
                        } else {
                            alert('Ogiltigt personligt åtkomsttoken.');
                            writeCookie(cookieName, '');
                            location.reload();
                        }
                    }
                });
            });
        });
    }

    var token = getToken();
    // Do we have a valid token?
    if (token) {
        loadAdminState(token);
    } else {
        var button = document.getElementById('staticweb-login-btn')
        button.addEventListener('click', function () {
            var input = document.getElementById('staticweb-login-token');
            var token = sanitizeToken(input.value);
            if (token) {
                loadAdminState(token);
            } else {
                alert('Ogiltigt personligt åtkomsttoken.');
            }
        });
    }
})();
