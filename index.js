'use strict'
var mongoose = require('mongoose');
var app = require('./app');
var port = 3800;

mongoose.promise = global.Promise;

//Conexión a la BD
mongoose.connect('mongodb://localhost:27017/curso_mean_social', {useNewUrlParser: true, useUnifiedTopology: true} )
	.then(() => {
		console.log('La conexión ala base de datos curso_men_social se ha realizado correctamente!');

		//Crear servidor
		app.listen(port, () => {
			console.log('Servidor corriendo en http://localhost:3800');
		});
	})
	.catch(err => {
		console.log(err);
	});