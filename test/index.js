var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

chai.use(sinonChai)

var EventTracker = require('../index.js');

describe('EventTracker', function() {
  it('exists', function() {
    expect(typeof EventTracker).to.equal('function');
  });
});
