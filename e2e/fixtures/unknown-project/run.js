const http = require('http')
const port = process.env.PORT || 4000
http.createServer((req, res) => res.end('ok')).listen(port)
