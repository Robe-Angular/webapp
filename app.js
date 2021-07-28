'use strict'
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();

//cargar rutas
var user_routes = require('./routes/user');
var follow_routes = require('./routes/follow');
var publication_routes = require('./routes/publication');
var message_routes = require('./routes/message');

//cargar middlewares
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());

//cors
// configurar cabeceras http
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
 
    next();
});



//Rutas
//app.use(express.static(path.join(__dirname,'client')));
app.use('/', express.static('client', {redirect: false}));
app.use('/api', user_routes);
app.use('/api', follow_routes);
app.use('/api', publication_routes);
app.use('/api', message_routes);

app.get('*', function(req, res, next){
    res.sendFile(path.resolve('client/index.html'));
});

//Exportar
module.exports = app;