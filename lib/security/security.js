const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const nonce = require('nonce')();
const crypto = require('crypto');
const qs = require('querystring');
const jwt = require('jsonwebtoken');
// const jose = require('jose');
const jose = require('node-jose');
const URLSafeBase64 = require('urlsafe-base64');
const colors = require('colors');
const nonceGenerator = require('../nonceGenerator')
var security = {};

// Sorts a JSON object based on the key value in alphabetical order
function sortJSON(json) {
  if (_.isNil(json)) {
    return json;
  }

  var newJSON = {};
  var keys = Object.keys(json);
  keys.sort();

  for (key in keys) {
    newJSON[keys[key]] = json[keys[key]];
  }

  return newJSON;
};

/**
 * @param url Full API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId ClientId
 * @param keyCertContent Private Key Certificate content
 * @param keyCertPassphrase Private Key Certificate Passphrase
 * @returns {string}
 */

function generateRS256Header(url, params, method, strContentType, appId, keyCertContent, keyCertPassphrase) {
  var nonceValue = nonceGenerator();
  var timestamp = (new Date).getTime();
  
  // A) Construct the Authorisation Token Parameters
  var defaultAuthHeaders = {
    "app_id": appId, // App ID assigned to your application
    "nonce": nonceValue, // secure random number
    "signature_method": "RS256",
    "timestamp": timestamp // Unix epoch time
  };

  // B) Forming the Base String
  // Base String is a representation of the entire request (ensures message integrity)

  // i) Normalize request parameters
  var baseParams = sortJSON(_.merge(defaultAuthHeaders, params));

  var baseParamsStr = qs.stringify(baseParams);
  baseParamsStr = qs.unescape(baseParamsStr); // url safe

  // ii) concatenate request elements (HTTP method + url + base string parameters)
  var baseString = method.toUpperCase() + "&" + url + "&" + baseParamsStr;

  console.log('base string'.green, baseString);
  // C) Signing Base String to get Digital Signature
  var signWith = {
    key: fs.readFileSync(keyCertContent, 'utf8')
  }; // Provides private key

  // Load pem file containing the x509 cert & private key & sign the base string with it to produce the Digital Signature
  var signature = crypto.createSign('RSA-SHA256')
    .update(baseString)
    .sign(signWith, 'base64');

  // D) Assembling the Authorization Header
  var strAuthHeader = "PKI_SIGN app_id=\"" + appId + // Defaults to 1st part of incoming request hostname
    "\",nonce=\"" + nonceValue +
    "\",signature_method=\"RS256\"" +
    ",signature=\"" + signature +
    "\",timestamp=\"" + timestamp +
    "\"";

  return strAuthHeader;
};

/**
 * @param url API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId API ClientId
 * @param passphrase API Secret or certificate passphrase
 * @returns {string}
 */
security.generateAuthorizationHeader = function(url, params, method, strContentType, authType, appId, keyCertContent, passphrase) {

  if (authType == "L2") {
    return generateRS256Header(url, params, method, strContentType, appId, keyCertContent, passphrase);
  } else {
    return "";
  }

};


// Verify & Decode JWS or JWT
security.verifyJWS = function verifyJWS(jws, publicCert) {
  // verify token
  // ignore notbefore check because it gives errors sometimes if the call is too fast.
  try {
    var decoded = jwt.verify(jws, fs.readFileSync(publicCert, 'utf8'), {
      algorithms: ['RS256'],
      ignoreNotBefore: true
    });
    return decoded;
  } catch (error) {
    console.error("\x1b[31mError with verifying and decoding JWS:\x1b[0m %s", error);
    throw ("Error with verifying and decoding JWS");
  }
}

// Decrypt JWE using private key
security.decryptJWE = function decryptJWE(header, encryptedKey, iv, cipherText, tag, privateKey) {
  console.log("\x1b[32mDecrypting JWE \x1b[0m(Format: \x1b[31m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[36m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[32m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[35m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[33m%s\x1b[0m)", "header", ".", "encryptedKey", ".", "iv", ".", "cipherText", ".", "tag");
  console.log("\x1b[31m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[36m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[32m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[35m%s\x1b[0m\x1b[1m%s\x1b[0m\x1b[33m%s\x1b[0m", header, ".", encryptedKey, ".", iv, ".", cipherText, ".", tag);
  try {
    var keystore = jose.JWK.createKeyStore();
    var plain = "";
    var data = {
      "type": "compact",
      "ciphertext": cipherText,
      "protected": header,
      "encrypted_key": encryptedKey,
      "tag": tag,
      "iv": iv,
      "header": JSON.parse(jose.util.base64url.decode(header).toString())
    };
    return new Promise(function(resolve, reject) {
      keystore.add(fs.readFileSync(privateKey, 'utf8'), "pem")
        .then(function(jweKey) {
          // {result} is a jose.JWK.Key
          console.log("jweKey: ", jweKey);
          jose.JWE.createDecrypt(jweKey)
            .decrypt(data)
            .then(function(result) {
              var data = result.payload.toString();
              plain = JSON.parse(data);

              resolve(plain);
            })
            .catch(function(error) {
              console.log("Decryption Failed..." + error);
              reject(error);
            });
        });
    });
  } catch (error) {
    console.error("\x1b[31mError with decrypting JWE:\x1b[0m %s", error);
    throw ("Error with decrypting JWE");
  }
}

module.exports = security;