var request = require('request'),
    Q = require('q');

module.exports = function createRequest(options) {

    var bamboo = request.defaults(options);

    return function(resource) {
        var deferred = Q.defer();

        bamboo.get(resource, function(error, response, body) {

            if (error) {
                return deferred.reject(error);
            }

            if (response.statusCode !== 200) {
                try {
                    var message = JSON.parse(body).message
                } catch (e) {}
                return deferred.reject(message || response.statusMessage);
            }

            deferred.resolve(JSON.parse(body));
        });

        return deferred.promise;
    }
}
