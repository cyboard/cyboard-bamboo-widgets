var events = require('events'),
    request = require('request'),
    q = require('q');

/**
 * Widget factory
 *
 * This wrapper is only for injecting services.
 *
 * @param {cyboard.AuthManager} auth
 * @returns {Function(object)}
 */
module.exports = function(auth) {

    /**
     * The Widget. Is called for each instance and gets config object passed
     *
     */
    return function(config) {

        var emitter = new events.EventEmitter;

        function go() {
            loadData(config.host, auth.getBasicAuthHeader(config.auth), config.timeout)
                .then(splitBuldingAndQueued)
                .then(function (data) {
                    emitter.emit('data', data);
                    setTimeout(go, config.interval || 15000);
                })
                .catch(function (error) {
                    emitter.emit('error', error);
                    setTimeout(go, 3000);
                })
                .done();
        }

        process.nextTick(go);

        return emitter;
    }
}
module.exports.$inject = ['authManager']

/**
 *
 * @param builds
 * @returns {{building: Array, queued: Array}}
 */
function splitBuldingAndQueued(builds) {
    var result = {
        building: [],
        queued: []
    };

    builds.forEach(function(build) {
        if (build.status === "BUILDING") {
            result.building.push(build);
        } else {
            result.queued.push(build);
        }
    });

    return result;
};

/**
 *
 * @param host
 * @param authHeader
 * @param timeout
 * @returns {q.Promise}
 */
function loadData(host, authHeader, timeout) {
    var deferred = q.defer(),
        options;

    options = {
        timeout: timeout || 15000,
        url: host + '/build/admin/ajax/getDashboardSummary.action?_=' + Date.now(),
        headers: {
            "authorization": authHeader
        }
    };

    request(options, function(error, response, body) {
        if (error) {
            return deferred.reject(error);
        }

        try {
            var builds = JSON.parse(body).builds;
            deferred.resolve(builds);
        } catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
}