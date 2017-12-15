var assert = require('should');
const scanner = require('../src/app/middleware/scanner');
const path = require('path');

require('./helpers/app-helper');

describe('Scanner', function() {
  describe('#folder', function() {
    it('scan folder should not work on non existing folder', function(done) {
        // [ 1, 2, 3].should.containDeep([2, 1]);
        scanner.scanFolder('~').then(() => {
            done("Should be in error");
        }).catch((err) => {
            done();
        });
    });

    it('scan folder should work on existing folder', function(done) {
        // [ 1, 2, 3].should.containDeep([2, 1]);
        console.log(path.resolve(__dirname, './library_test'))
        scanner.scanFolder(path.resolve(__dirname, './library_test/one')).then((elements) => {
            console.log(elements);
            done();
        }).catch((err) => {
            done(err);
        });
    });
  });
});
