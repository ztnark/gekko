// This config is used in both the
// frontend as well as the web server.

const CONFIG = {
  api: {
    ssl: false,
    host: '104.198.182.217',
    port: 3000,
    path: '/'
  }
}

if(typeof window === 'undefined')
  module.exports = CONFIG;
else
  window.CONFIG = CONFIG;
