var request = require('request');
const nconf = require('nconf');
var winston = require('winston');

nconf.file({ file: "config.json" });

if(nconf.get('id') === 'default') {
  nconf.set('id', (new Date%9e6).toString(36) + (0|Math.random()*9e6).toString(36));
  nconf.save();
  logger.debug('Replacing "default" id by "' + nconf.get('id') + '"');
}

var id  = nconf.get('id');
var pw  = nconf.get('pw');

var url = nconf.get('postip');

var logger = new (winston.Logger)({
    transports: [
        new winston.transports.File({
            level: 'info',
            filename: './postip.log',
            handleExceptions: true,
            json: false,
            maxsize: 5242880, //5MB
            maxFiles: 5,
            colorize: false
        }),
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

logger.debug('Updating ip to ' + url);

request({
    url: url,
    qs: { "id": id, "pwd": pw },
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: ''
}, function(error, response, body){
    if(error) {
        logger.error(error);
    } else {
        logger.info('Update successful', body);
    }
});