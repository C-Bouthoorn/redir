const http = require('http');
const https = require('https');
const fs = require('fs');
const chalk = require('chalk');
const error = chalk.bold.red;
const http_proxy = require('http-proxy');


const redir = require('./hosts');

// Add your certificates here
const certs = {
  key: fs.readFileSync('./certs/localdev.key'),
  cert: fs.readFileSync('./certs/localdev.crt'),
};


// Catch all exceptions so it doesn't crash
process.on('uncaughtException', function(err) {
  let code = err.code;

  if (code == 'EACCES' && err.syscall == 'listen') {
    console.error(error(`EACCESS: Failed to listen on port ${err.port}`));
  } else if (code == 'ECONNREFUSED' && err.syscall == 'connect') {
    console.error(error(`ECONNREFUSED: Failed to connect to ${err.address}:${err.port}`));
  }
  else if (code == 'ECONNRESET') {
    console.error(error(`ECONNRESET: socket hang up`));
  }

  else {
    console.error(err);
  }
});


// Start proxy
let proxy = http_proxy.createProxyServer({});


// Check if host is up
function check_host(target, callback) {
  let protocol = target.split(':')[0];

  (protocol == 'http' ? http : https)
    .get(target, function(res) {
      callback(true);
    })
    .on('error', function(err) {
      callback(false);
    });
}


// Get host from hosts file
function get_host(host) {
  let h = redir[host];

  // Alias
  if (typeof h === 'string') {
    if (h == host) {
      // Prevent infinite loop
      console.error(error(`Infinite loop in hosts.js file: ${host} → ${h}`));
      return (h != '__fallback') ? get_host('__fallback') : {};
    }

    return get_host(h);
  }

  // Fallback
  h = h || ((h != '__fallback') ? get_host('__fallback') : {});

  return h;
}



// Create a server for given protocol
function create_server(_protocol) {
  return (req, res) => {
    const protocol = _protocol;
    const protocol_port = protocol == 'http' ? 80 : 443;

    // Seperate subdomains from host
    let raw_host = req.headers.host.split('.');
    let subdomains = raw_host.slice(0, raw_host.length - 2);
    let host = raw_host.slice(-2).join('.');

    // Get port from table
    let port = get_host(host)[protocol];

    // Check if port exists in table, send 404 otherwise
    if (typeof port === 'undefined') {
      console.error(error(`Undefined host '${host}', sending 404!`));
      res.statusCode = 404;
      res.statusMessage = `Unknown host`;
      res.end();
      return;
    }

    // Convert subdomains into prefix
    let subdomain_prefix = subdomains.join('.') + (subdomains.length > 0 ? '.' : '');

    // Generate target url
    let target = `${protocol}://${subdomain_prefix}local.dev:${port}`;

    // Get color by protocol (HTTPS: green, HTTP: yellow)
    let color = (protocol == 'https' ? chalk.green : chalk.yellow);

    // Log for debugging
    console.log(color(protocol.toUpperCase()) + `\t${protocol}://${raw_host.join('.')}:${protocol_port} → ${target}`);

    // Check if host is up
    check_host(target, function(up) {
      if (! up) {
        console.error(error(`Failed to connect to ${chalk.magenta(target)}, sending 404`));

        res.statusCode = 404;
        res.statusMessage = `Host unreachable`;
        res.end();
        return;
      }

      // Everything is OK, send to proxy
      proxy.web(req, res, { target });
    });
  };
}


// Start HTTP server
http
  .createServer(create_server('http'))
  .listen(80, () => {
    console.log(`${chalk.yellow(`HTTP`)}\tserver started on port 80`);
  });


// Start HTTPS server
https
  .createServer(certs, create_server('https'))
  .listen(443, () => {
    console.log(`${chalk.green(`HTTPS`)}\tserver started on port 443`);
  });
