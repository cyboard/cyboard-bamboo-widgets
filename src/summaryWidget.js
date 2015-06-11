var _ = require('lodash'),
    Q = require('q'),
    events = require('events'),
    createRequest = require('./request');

module.exports = function(auth) {

    return function(config) {

        var emitter = new events.EventEmitter(),
            bamboo = createRequest({
                baseUrl: config.host + '/rest/api/latest/',
                timeout: config.timeout || 15000,
                headers: {
                    accept: "application/json",
                    authorization: auth.getBasicAuthHeader(config.auth)
                }
            });

        function go() {
            normalizePlanKeys(config.plans, bamboo)
                .then(loadResults(bamboo))
                .then(processResultsData)
                .then(addLinksToResults(config.host))
                .then(function(data) {
                    var passing = _.where(data, { success: true }).length,
                        failing = data.length - passing;

                    emitter.emit('data', {
                        passing: passing,
                        failing: failing,
                        builds: data
                    });
                })
                .catch(function(err) {
                    emitter.emit('error', err);
                });
        }

        process.nextTick(go);

        return emitter;
    };

}
module.exports.$inject = ['authManager'];

function normalizePlanKeys(keys, request) {
    var normalized = [],
        exp = /^([A-Z]+)-(\*|[A-Z]+)(\*|[0-9]+)*$/;

    keys.forEach(function(key) {
        var match = key.match(exp);

        if (!match) {
            key = Q.reject('Unknown plan key pattern: ' + key);
        } else if (match[2] !== '*' && match[3] !== '*') {
            key = Q(key);
        } else {
            key = request('project/' + match[1] + '?expand=plans.plan.branches&maxResults=200').then(function (project) {
                var subKeys = []
                project.plans.plan.forEach(function (plan) {
                    if (match[2] === '*' || match[2] === plan.key) {
                        subKeys.push(plan.key);
                    }
                    if (plan.branches && plan.branches.branch && match[3]) {
                        plan.branches.branch.forEach(function (branch) {
                            if (match[3] === '*' || match[2] + match[3] === branch.shortKey) {
                                subKeys.push(branch.key);
                            }
                        });
                    }
                });
                return subKeys;
            });
        }

        normalized.push(key);
    });

    return Q.all(normalized).then(function(keys) {
        return _.unique(_.flatten(keys));
    });
}

function loadResults(request) {
    return function(keys) {

        var requests = keys.map(function(key) {
            return request('result/' + key + '/latest?expand=changes')
                .catch(function(error) {
                    return null;
                });
        })

        return Q.all(requests).then(function(results) {
            return results.filter(function(result) {
                return result && result.plan && result.plan.enabled;
            });
        })
    }
}

function processResultsData(results) {
    return results.map(function(build) {
        return {
            planKey: build.plan.key,
            planName: build.plan.name,
            planShortName: build.plan.shortName,
            responsible: extractAuthorsFromChanges(build.changes.change),
            failBuildKey: build.key,
            isRefreshing: build.lifeCycleState === "NotBuilt",
            success : build.state === "Successful"
        }
    });
}

function extractAuthorsFromChanges(changes) {

    var authors = changes.map(function(changeset) {
        if (typeof changeset.author === "string") {
            var matches = changeset.author.match(/^(.*)\s+\<(.*)\>$/);
            if (matches) {
                return {
                    name: matches[1],
                    email: matches[2]
                };
            }
        }
    });

    authors = _.unique(authors, function (author) {
        return author.name
    });

    return authors;
}

function addLinksToResults(host) {
    return function(results) {
        results.forEach(function(result) {
            result.link = host + "/browse/" + result.planKey;
        });
        return results;
    }
}