'use strict';
console.log('Loading funciton...');

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
const appstream = new AWS.AppStream({region: 'us-east-1'});
var crypto = require('crypto');
//var password = require('./password');
//var algorithm = 'aes-256-ctr';
//var cryptopassword = 'LYKISYPEIblVuF7HBzeSfXn7SrxoemmbsTR9HRucrFUQzbEMPvLtnt6cmcWaYPiNY4hznNpn4qGx1dlYonWjsL9QVqoqVvYLUgur';

var digest = 'sha256';
var iterations = 99999;
var keyLength = 32;

var hash = function(password) {
    var executor = function(resolve, reject) {
      var callback = function(error, salt) {
        if (error) {
          return reject(error);
        }
  
        var callback = function(error, key) {
          if (error) {
            return reject(error);
          }
  
          var buffer = new Buffer(keyLength * 2);
  
          salt.copy(buffer);
          key.copy(buffer, salt.length);
  
          resolve(buffer.toString('base64'));
        };
  
        crypto.pbkdf2(password, salt, iterations, keyLength, digest, callback);
      };
  
      crypto.randomBytes(keyLength, callback);
    };
  
    return new Promise(executor);
  };
  
var same = function(password, hash) {
    var executor = function(resolve, reject) {
      var buffer = new Buffer(hash, 'base64');
      var salt = buffer.slice(0, keyLength);
      var keyA = buffer.slice(keyLength, keyLength * 2);
  
      var callback = function(error, keyB) {
        if (error) {
          return reject(error);
        }
  
        resolve(keyA.compare(keyB) == 0);
      };
  
      crypto.pbkdf2(password, salt, iterations, keyLength, digest, callback);
    };
  
    return new Promise(executor);
  };

/*
function encrypt(text){
  var cipher = crypto.createCipher(algorithm,cryptopassword);
  var crypted = cipher.update(text,'utf8','hex');
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text){
  var decipher = crypto.createDecipher(algorithm,cryptopassword);
  var dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
}
*/

exports.handler = (event, context, callback) => {
    let username=event.username.toLowerCase();
    let password=event.password;

    let params = {
        TableName: 'AS_USERS',
        KeyConditionExpression: "#username = :username",
        ExpressionAttributeNames:{
            "#username": "username"
        },
        ExpressionAttributeValues: {
            ":username":username
        }
    }

    docClient.query(params, function(err,data){
        if(err){
            // dynamodb query error
            console.log('Error: ' + err);
            callback(err,null);
        }else{
            let RecsReturn = data.Count;
            // if > 0, username found
            if(parseInt(RecsReturn) > 0) {
                // check if password is valid
                //let dbpassword = decrypt(data.Items[0].password);

                //if(password === dbpassword) {
                if(same(password,data.Items[0].password)){
                    // successful authentication
                    console.log('Login successful for ' + username + ', requesting an AppStream session...');

                    var AppStreamParams = {
                      FleetName: 'AppStreamDemo',
                      StackName: 'AppStreamDemo',
                      UserId: username,
                      Validity: 45
                    };

                    // create streaming url with app stream params
                    appstream.createStreamingURL(AppStreamParams, function(AppStreamErr, AppStreamData) {
                      if (AppStreamErr){
                          // streaming url creation error
                          console.log(AppStreamErr, AppStreamErr.stack);
                          callback(AppStreamErr,null);
                      }
                      else {
                          // successful streaming url creation
                          console.log(AppStreamData);
                          callback(null, AppStreamData);
                      }
                    });
                }else{
                    // invalid password
                    console.log('Login failed: invalid password for ' + username);
                    callback(null, JSON.parse('{ "message": "Login failed, invalid password" }'));
                }
            }else{
                // invalid username
                console.log('Login failed: invalid username ' + username);
                callback(null, JSON.parse('{ "message": "Login failed, invalid username" }'));
            }

        }
    });
};