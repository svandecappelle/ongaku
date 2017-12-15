var assert = require('should');
const version = require('../src/app/utils/version');
const path = require('path');

require('./helpers/app-helper');

describe('Version', function() {
  describe('#check', function() {
    it('Checking version', function(done) {
        version.current();
        done();
    });
  });
});
