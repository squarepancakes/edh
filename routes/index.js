var express = require('express');
var router = express.Router();

const restClient = require('superagent-bluebird-promise');
const path = require('path');
const url = require('url');
const util = require('util');
const Promise = require('bluebird');
const _ = require('lodash');
const querystring = require('querystring');
const securityHelper = require('../lib/security/security');
const crypto = require('crypto');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


// ####################
// Setup Configuration
// ####################

// LOADED FRON ENV VARIABLE: public key from EDH given to you during onboarding for RSA digital signature (JWS verification)
var _publicCertContent = process.env.EDH_SIGNATURE_CERT_PUBLIC_CERT;
// LOADED FRON ENV VARIABLE: your private key for RSA digital signature
var _privateKeyContent = process.env.DEMO_APP_SIGNATURE_CERT_PRIVATE_KEY;
// LOADED FRON ENV VARIABLE: your client_id provided to you during onboarding
var _clientId = process.env.EDH_APP_CLIENT_ID;
// LOADED FRON ENV VARIABLE: your client_secret provided to you during onboarding
//var _clientSecret = process.env.EDH_APP_CLIENT_SECRET;
// redirect URL for your web application
var _redirectUrl = process.env.EDH_APP_REDIRECT_URL;

// URLs for EDH APIs
var _authLevel = process.env.AUTH_LEVEL;

var _entityApiUrl = process.env.EDH_API_ENTITY;

// Requested attributes

var _attributes = "entitytype,basic-profile,addresses,history,financials,capitals,declarations,charges,shareholders,appointments,licences,grants"




/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname + '/../views/html/index.html'));
});

// callback function - directs back to home page
router.get('/callback', function(req, res, next) {
  res.sendFile(path.join(__dirname + '/../views/html/index.html'));
});

// function for getting environment variables to the frontend
router.get('/getEnv', function(req, res, next) {
  if (_clientId == undefined || _clientId == null)
    res.jsonp({
      status: "ERROR",
      msg: "client_id not found"
    });
  else
    res.jsonp({
      status: "OK",
      clientId: _clientId,
      redirectUrl: _redirectUrl,
      attributes: _attributes,
      authLevel: _authLevel
    });
});

// function for frontend to call backend
router.post('/getEntityData', function(req, res, next) {
  // get variables from frontend
  var uen = req.body.uen;
  console.log("uen:" + uen);
  callEntityAPI(uen, res);
});

function callEntityAPI(uen, res) {

  console.log("uen:".blue + uen);

  // **** CALL ENTITY API ****
  // Call Entity API using uen
  var request = createEntityRequest(uen);

  // Invoke asynchronous call
  request
    .buffer(true)
    .end(function(callErr, callRes) {
      if (callErr) {
        console.log("Error from Entity API:".red);
        console.log(callErr.status);
        console.log(callErr.response.req.res.text);
        res.jsonp({
          status: "ERROR",
          msg: callErr
        });
      } else {
        // SUCCESSFUL
        var data = {
          body: callRes.body,
          text: callRes.text
        };

        var entityData = data.text;
        if (entityData == undefined || entityData == null) {
          res.jsonp({
            status: "ERROR",
            msg: "ENTITY DATA NOT FOUND"
          });
        } else {
          if (_authLevel == "L0") {
            entityData = JSON.parse(entityData);

            console.log("Entity Data :".green);
            console.log(JSON.stringify(entityData));
            // successful. return data back to frontend
            res.jsonp({
              status: "OK",
              text: entityData
            });

          } else if (_authLevel == "L2") {
            console.log("Response from Entity API:".green);
            console.log(entityData);
            // header.encryptedKey.iv.ciphertext.tag
            var jweParts = entityData.split(".");

            securityHelper.decryptJWE(jweParts[0], jweParts[1], jweParts[2], jweParts[3], jweParts[4], _privateKeyContent)
              .then(entityData => {
                if (entityData == undefined || entityData == null)
                  res.jsonp({
                    status: "ERROR",
                    msg: "INVALID DATA OR SIGNATURE FOR ENTITY DATA"
                  });

                console.log("Entity Data (JWS):".green);
                console.log(JSON.stringify(entityData));

                var decodedEntityData = securityHelper.verifyJWS(entityData, _publicCertContent);

                if (decodedEntityData == undefined || decodedEntityData == null) {
                  res.jsonp({
                    status: "ERROR",
                    msg: "INVALID DATA OR SIGNATURE FOR ENTITY DATA"
                  })
                }

                console.log("Entity Data (Decoded):".green);
                console.log(JSON.stringify(decodedEntityData));
                // successful. return data back to frontend

                res.jsonp({
                  status: "OK",
                  text: decodedEntityData
                });
              })
              .catch(error => {
                console.error("Error with decrypting JWE: %s".red, error);
              })
          } else {
            throw new Error("Unknown Auth Level");
          }
        } // end else
      }
    }); // end asynchronous call

}

// function to prepare request for ENTITY API
function createEntityRequest(uen) {
  console.log("*******************************".green);
  console.log("**** Create Entity Request ****".green);
  console.log("*******************************".green);
  var url = _entityApiUrl + "/" + uen;
  var cacheCtl = "no-cache";
  var method = "GET";
  var request = null;
  // assemble params for Entity API
  var strParams = "client_id=" + _clientId +
    "&attributes=" + _attributes;
  var params = querystring.parse(strParams);

  // assemble headers for Entity API
  var strHeaders = "Cache-Control=" + cacheCtl;
  var headers = querystring.parse(strHeaders);
  var authHeaders;

  // Sign request and add Authorization Headers
  authHeaders = securityHelper.generateAuthorizationHeader(
    url,
    params,
    method,
    "", // no content type needed for GET
    _authLevel,
    _clientId,
    _privateKeyContent
  );
  if (!_.isEmpty(authHeaders)) {
    _.set(headers, "Authorization", authHeaders);
  }

  console.log("Request Header for Entity API:".green);
  console.log(JSON.stringify(headers));

  // invoke Entity API
  var request = restClient.get(url);

  // Set headers
  if (!_.isUndefined(headers) && !_.isEmpty(headers))
    request.set(headers);

  // Set Params
  if (!_.isUndefined(params) && !_.isEmpty(params))
    request.query(params);
  console.log("Sending Entity Request >>>".green);
  return request;
}

module.exports = router;