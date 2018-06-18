const vscode = require('vscode');
const request = require('request');
const cheerio = require('cheerio');
const AsciiTable = require('ascii-table');

module.exports = class HacUtil {
    constructor() {

    }

    extractSessionId(response) {
        return response.headers["set-cookie"][0].split(";")[0];
    }

    extractCsrfToken(body) {
        let html = cheerio.load(body);
        return html("input[name=_csrf]").val();
    }

    fetchCsrfTokenSessionId(successFunc, errorFunc) {
        let hacUrl = vscode.workspace.getConfiguration().get("hybris.hac.url")

        let self = this;

        // get the login form and extract the CSRF token
        request(hacUrl, { timeout: 1000 }, function (error, response, body) {
            if (response.statusCode == 200) {
                let csfr = self.extractCsrfToken(body);
                let sessionId = self.extractSessionId(response);
                successFunc(csfr, sessionId);
            } else {
                errorFunc(response.statusCode);
            }
        });
    }


    getCsrfTokenFromImpexPage(sessionId, successFunc, errorFunc) {
        let hacUrl = vscode.workspace.getConfiguration().get("hybris.hac.url")
        let hacImpexUrl = hacUrl + "/console/impex/import";

        let headers = {
            Cookie: sessionId
        }

        let self = this;

        // get the login form and extract the CSRF token
        request({ url: hacImpexUrl, headers: headers }, function (error, response, body) {
            if (response.statusCode == 200) {
                let csfr = self.extractCsrfToken(body);
                successFunc(csfr, sessionId);
            } else {
                errorFunc(response.statusCode);
            }
        });
    }

    login(csrfToken, sessionId, successFunc, errorFunc) {
        let username = vscode.workspace.getConfiguration().get("hybris.hac.username");
        let password = vscode.workspace.getConfiguration().get("hybris.hac.password");

        let hacUrl = vscode.workspace.getConfiguration().get("hybris.hac.url");
        var hacLoginUrl;

        if (hacUrl) {
            hacLoginUrl = hacUrl + "/j_spring_security_check";
        }

        let credentials = {
            j_username: username,
            j_password: password,
            _csrf: csrfToken
        };

        let headers = {
            Cookie: sessionId
        };

        let self = this;

        // login
        request.post({ url: hacLoginUrl, headers: headers, form: credentials }, function (error, response, body) {
            if (response.statusCode == 302) {
                //  successfully logged in

                let sessionId = self.extractSessionId(response);
                self.getCsrfTokenFromImpexPage(sessionId, successFunc, errorFunc);
            } else {
                // pass extracted error message
                errorFunc(response.statusCode);
            }
        });
    }

    executeImpex(impexContent, successFunc, errorFunc) {
        let self = this;

        self.fetchCsrfTokenSessionId(function (csrfToken, sessionId) {
            self.login(csrfToken, sessionId, function (csrfToken, sessionId) {
                let hacUrl = vscode.workspace.getConfiguration().get("hybris.hac.url")
                var hacImpexActionUrl;

                if (hacUrl) {
                    hacImpexActionUrl = hacUrl + "/console/impex/import";
                }

                let formContent = {
                    scriptContent: impexContent,
                    _csrf: csrfToken,
                    _distributedMode: "on",
                    _enableCodeExecution: "on",
                    _legacyMode: "on",
                    _sldEnabled: "on",
                    encoding: "UTF-8",
                    maxThreads: 1,
                    validationEnum: "IMPORT_STRICT"
                };

                let headers = {
                    Cookie: sessionId
                };

                // import impex
                request.post({ url: hacImpexActionUrl, headers: headers, form: formContent }, function (error, response, body) {
                    var html = cheerio.load(body);
                    var impexResult = html(".impexResult > pre").text();

                    if (response.statusCode == 200 && !impexResult) {
                        //  successfully logged in
                        successFunc();
                    } else {
                        errorFunc("Import has encountered problems", "Import error: " + impexResult.trim());
                    }
                });
            }, function (statusCode) {
                errorFunc('Could not login with stored credentials (http status=' + statusCode + ').');
            });
        }, function (statusCode) {
            errorFunc('Could not retrieve CSFR token (http status=' + statusCode + ').');
        });
    }

    executeImpexValidation(impexContent, successFunc, errorFunc) {
        let self = this;

        self.fetchCsrfTokenSessionId(function (csrfToken, sessionId) {
            self.login(csrfToken, sessionId, function (csrfToken, sessionId) {
                let hacUrl = vscode.workspace.getConfiguration().get("hybris.hac.url")
                var hacImpexActionUrl;

                if (hacUrl) {
                    hacImpexActionUrl = hacUrl + "/console/impex/import/validate";
                }

                let formContent = {
                    scriptContent: impexContent,
                    _csrf: csrfToken,
                    _distributedMode: "on",
                    _enableCodeExecution: "on",
                    _legacyMode: "on",
                    _sldEnabled: "on",
                    encoding: "UTF-8",
                    maxThreads: 1,
                    validationEnum: "IMPORT_STRICT"
                };

                let headers = {
                    Cookie: sessionId
                };

                // validate impex
                request.post({ url: hacImpexActionUrl, headers: headers, form: formContent }, function (error, response, body) {
                    var html = cheerio.load(body);
                    var impexResult = html("span#validationResultMsg[data-level='error']").attr("data-result");

                    if (response.statusCode == 200 && impexResult === undefined) {
                        //  successfully logged in
                        successFunc();
                    } else {
                        errorFunc("Validation has encountered problems", "Validation error:" + (impexResult !== undefined ? impexResult.trim() : ""));
                    }
                });
            }, function (statusCode) {
                errorFunc('Could not login with stored credentials (http status=' + statusCode + ').');
            });
        }, function (statusCode) {
            errorFunc('Could not retrieve CSFR token (http status=' + statusCode + ').');
        });
    }

    executeFlexibleSearch(query, successFunc, errorFunc) {
        let self = this;

        self.fetchCsrfTokenSessionId(function (csrfToken, sessionId) {
            self.login(csrfToken, sessionId, function (csrfToken, sessionId) {
                let hacUrl = vscode.workspace.getConfiguration().get("hybris.hac.url")
                var hacImpexActionUrl;

                if (hacUrl) {
                    hacImpexActionUrl = hacUrl + "/console/flexsearch/execute";
                }

                let formContent = {
                    _csrf: csrfToken,
                    commit: false,
                    flexibleSearchQuery: query,
                    locale: "de",
                    maxCount: 200,
                    sqlQuery: "",
                    user: "admin"
                };

                let headers = {
                    Cookie: sessionId
                };

                // validate impex
                request.post({ url: hacImpexActionUrl, headers: headers, form: formContent }, function (error, response, body) {
                    var result = JSON.parse(body);

                    if (response.statusCode == 200 && result.exception == null) {
                        //  successfully logged in
                        successFunc(self.json2AsciiTable(result));
                    } else {
                        errorFunc("Flexible search query could not be executed", result.exception.message);
                    }
                });
            }, function (statusCode) {
                errorFunc('Could not login with stored credentials (http status=' + statusCode + ').');
            });
        }, function (statusCode) {
            errorFunc('Could not retrieve CSFR token (http status=' + statusCode + ').');
        });
    }

    json2AsciiTable(queryResultObject) {
        var table = new AsciiTable(new Date(), null);
        var headers = ["#"].concat(queryResultObject.headers);

        table.setHeading(headers);
        for (var x = 0; x < queryResultObject.resultList.length; x++) {
            var row = [x].concat(queryResultObject.resultList[x]);
            table.addRow(row);
        }

        return table.toString();
    }
}