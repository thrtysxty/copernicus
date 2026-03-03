const path = require('path');
const storiesPath = '/Users/dadmin/Projects/docs/stories';
console.log(!storiesPath.endsWith('.copernicus/docs/stories') && storiesPath.split(path.sep).length > 4);
