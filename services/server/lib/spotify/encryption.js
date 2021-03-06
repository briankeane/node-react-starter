const crypto = require('crypto');
const settings = require('../../settings');
const encSecret = settings.SPOTIFY_ENCRYPTION_SECRET;

/**
 * Uses encryption secret defined in environment to encrypt
 * tokens ready for network transfer. Uses symmetric encryption
 * so the token can then be
 *
 * @param {String} String to encrypt
 *
 * return String The encrypted string
 */
module.exports.encrypt = function (text) {
  var cipher = crypto.createCipher('aes192', encSecret);
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
};

/**
 * Uses encryption secret defined in environment to decrypt
 * a string. This is usually a refresh token which has been
 * sent from a client application.
 *
 * @param {String} String to decrypt
 *
 * return String The decrypted string
 */
module.exports.decrypt = function (text) {
  var decipher = crypto.createDecipher('aes192', encSecret);
  var dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
};