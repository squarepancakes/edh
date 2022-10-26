const _ = require("lodash");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const qs = require("querystring");
const jwt = require("jsonwebtoken");
const jose = require("jose");
const URLSafeBase64 = require("urlsafe-base64");
const colors = require("colors");
const nonceGenerator = require("../nonceGenerator");

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
}

/**
 * @param url Full API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId ClientId
 * @param keyCertContent Private Key Certificate content
 * @param keyCertPassphrase Private Key Certificate Passphrase
 * @returns {string}
 */

function generateRS256Header(
  url,
  params,
  method,
  strContentType,
  appId,
  keyCertContent,
  keyCertPassphrase
) {
  var nonceValue = nonceGenerator();
  var timestamp = new Date().getTime();

  // A) Construct the Authorisation Token Parameters
  var defaultAuthHeaders = {
    app_id: appId, // App ID assigned to your application
    nonce: nonceValue, // secure random number
    signature_method: "RS256",
    timestamp: timestamp, // Unix epoch time
  };

  // B) Forming the Base String
  // Base String is a representation of the entire request (ensures message integrity)

  // i) Normalize request parameters
  var baseParams = sortJSON(_.merge(defaultAuthHeaders, params));

  var baseParamsStr = qs.stringify(baseParams);
  let baseUrlStr = new URLSearchParams(baseParams).toString();
  // console.log("URL Params".rainbow, urlParams);
  // console.log("Base Params".rainbow, baseParamsStr);
  // urlParams = new URLSearchParams(`=${urlParams}`).get("");
  let str = "I%20love%20geek+sf?orgeeks";
  baseParamsStr = qs.unescape(baseParamsStr); // url safe
  const escapeHere = qs.unescape(baseParamsStr); // url safe
  const urlescape = new URLSearchParams(`=${baseUrlStr}`).get("");
  console.log("Base Params unescape".rainbow, escapeHere);
  console.log("URL Params remove per".rainbow, urlescape);

  // ii) concatenate request elements (HTTP method + url + base string parameters)
  var baseString = method.toUpperCase() + "&" + url + "&" + baseParamsStr;

  console.log("base string".green, baseString);
  // C) Signing Base String to get Digital Signature
  var signWith = {
    key: fs.readFileSync(keyCertContent, "utf8"),
  }; // Provides private key

  // Load pem file containing the x509 cert & private key & sign the base string with it to produce the Digital Signature
  var signature = crypto
    .createSign("RSA-SHA256")
    .update(baseString)
    .sign(signWith, "base64");

  // D) Assembling the Authorization Header
  var strAuthHeader =
    'PKI_SIGN app_id="' +
    appId + // Defaults to 1st part of incoming request hostname
    '",nonce="' +
    nonceValue +
    '",signature_method="RS256"' +
    ',signature="' +
    signature +
    '",timestamp="' +
    timestamp +
    '"';

  return strAuthHeader;
}

/**
 * @param url API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId API ClientId
 * @param passphrase API Secret or certificate passphrase
 * @returns {string}
 */
security.generateAuthorizationHeader = function (
  url,
  params,
  method,
  strContentType,
  authType,
  appId,
  keyCertContent,
  passphrase
) {
  if (authType == "L2") {
    return generateRS256Header(
      url,
      params,
      method,
      strContentType,
      appId,
      keyCertContent,
      passphrase
    );
  } else {
    return "";
  }
};

// Verify & Decode JWS or JWT
security.verifyJWS = async function verifyJWS(jws, publicCert) {
  // verify token
  // ignore notbefore check because it gives errors sometimes if the call is too fast.
  const fsPublic = fs.readFileSync(publicCert, "utf8");
  const keyLike = crypto.createPublicKey(fsPublic);

  try {
    return await jose
      .jwtVerify(jws, keyLike, {
        algorithms: ["RS256"],
      })
      .then(({ payload }) => {
        console.log(payload);
        return payload;
      })
      .catch((error) => console.log(error));
  } catch (error) {
    console.error(
      "\x1b[31mError with verifying and decoding JWS:\x1b[0m %s",
      error
    );
    throw "Error with verifying and decoding JWS";
  }
};

// Decrypt JWE using private key
security.decryptJWE = function decryptJWE(jwe, privateKey) {
  try {
    const fsPrivate = fs.readFileSync(privateKey, "utf8");
    return jose.importPKCS8(fsPrivate, "RS256").then((jweKey) => {
      console.log("Jwe Key".green, jwe, jweKey);
      return jose.compactDecrypt(jwe, jweKey).then((decryptData) => {
        console.log("Decrypt Data", decryptData);
        const result = JSON.parse(
          new TextDecoder().decode(decryptData.plaintext)
        );
        console.log("Results Decrypt " + result);
        return result;
      });
    });
  } catch (error) {
    console.error("\x1b[31mError with decrypting JWE:\x1b[0m %s", error);
    throw "Error with decrypting JWE";
  }
};

module.exports = security;
