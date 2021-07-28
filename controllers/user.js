'use strict'
var bcrypt = require('bcrypt-nodejs');
var  mongoosePaginate = require('mongoose-pagination');
var fs = require('fs');
var path = require('path');

var User = require('../models/user');
var Follow = require('../models/follow');
var Publication = require('../models/publication');
var jwt = require('../services/jwt');

//Métodos de prueba
function home(req, res){
	res.status(200).send({
		message: "Hola mundo"
	});
}

function pruebas(req, res){
	console.log(req.body);
	res.status(200).send({
		message: "Acción de pruebas en el servidor de NodeJS"
	});
}

//Registro
function saveUser(req, res){
	var params = req.body;
	var user = new User();
	if(params.name && params.surname && params.nick && params.email && params.password){
		user.name = params.name;
		user.surname = params.surname;
		user.nick = params.nick;
		user.email = params.email;
		user.role = 'ROLE_USER';
		user.image = null;

		//Controlar usuarios duplicados
		User.find({ $or: [
				{email: user.email.toLowerCase()},
				{nick: user.nick.toLowerCase()}
			]}).exec((err, users) => {
				if(err) return res.status(500).send({message:'Error en la petición de usuarios'});
				if(users && users.length >= 1){
					return res.status(200).send({
						message:'El usuario que intentas registrar ya existe'
					});
				}else{
					//Cifra la password y guarda los datos
					bcrypt.hash(params.password, null, null, (err, hash) => {
						user.password = hash;

						user.save((err, userStored) => {
							if(err) return res.status(500).send({message:'Error al guardar el usuario'});

							if(userStored){
								userStored.password = undefined;
								res.status(200).send({user: userStored});
							}else{
								res.status(404).send({message:'No se ha registrado el usuario'})
							}
						});

					});
				}
			});

		

	}else{
		res.status(200).send({
			message: 'Envía todos los campos necesarios'
		})
	}
}

//Login
function loginUser(req, res){
	var params = req.body;

	var email = params.email;
	var password = params.password;
	User.findOne({email: email}, (err, user) => {
		if(err) return res.status(500).send({message: 'Error en la petición'});
		if(user){
			bcrypt.compare(password, user.password, (err, check) => {
				if(check){
					//Devolver datos de usuario
					if(params.gettoken){
						// Generar y devolver Token
						return res.status(200).send({
							token: jwt.createToken(user)
						});
					}else{
						//Devolver datos del usuario
						user.password = undefined;
						return res.status(200).send({user});
					}
					
				}else{
					return res.status(404).send({message: 'El usuario no se ha podido identificar'});
				}
			});
		}else{
			return res.status(404).send({message: 'El usuario no se ha podido identificar!!'});
		}
	});
}

//Conseguir datos de un usuario
function getUser(req, res){
	var userId = req.params.id;

	User.findById(userId, (err, user) => {
		if(err) return res.status(500).send({
			message:'Error en la petición'
		});

		if(!user) return res.status(500).send({
			message:'El usuario no existe'
		});
		user.password = undefined;
		followThisUser(req.user.sub,userId).then((value) => {
			return res.status(200).send({user, following: value.following, followed: value.followed});
		});
		

		
	})
}

async function followThisUser(identity_user_id, user_id){
	var following = await Follow.findOne({'user':identity_user_id, 'followed':user_id}).exec().then((follow) => {
			
			
			return follow;
		}).catch((err) => {
        return handleError(err);
    });

	var followed = await Follow.findOne({'followed':identity_user_id, 'user':user_id}).exec().then((follow) => {
			return follow;

		}).catch((err) => {
        return handleError(err);
    });


	return {
		following,
		followed
	};
} 

//Devolver un listado de usuarios paginado
function getUsers(req, res){
	var identity_user_id = req.user.sub;

	var page= 1;
	
	if(req.params.page){
		page = req.params.page;
	}

	var itemsPerPage = 5;

	User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total) => {
		if(err) return res.status(500).send({
			message:'Error en la petición'
		});

		if(!users) return res.status(404).send({
			message: 'No hay usuarios disponibles'
		});
		users.forEach(user => {
			user.password = undefined;
		});

		followUserIds(identity_user_id).then((value) =>{
			return res.status(200).send({
				users,
				users_following: value.following,
				users_followed: value.followed,
				total,
				pages: Math.ceil(total / itemsPerPage)
			});
		});
		
	});
}

async function followUserIds(user_id){
	var following = await Follow.find({"user": user_id}).select({'_id':0,'__v':0, 'user':0}).exec().then((follows) => {
		var follows_clean =[];

		follows.forEach((follow) => {
			follows_clean.push(follow.followed);
		})
		return follows_clean;
	}).catch((err) => {
        return handleError(err);
	});
	var followed = await Follow.find({"followed": user_id}).select({'_id':0,'__v':0, 'followed':0}).exec().then((follows) => {
		var follows_clean =[];

		follows.forEach((follow) => {
			follows_clean.push(follow.user);
		});

		return follows_clean;
	}).catch((err) => {
        return handleError(err);
	});

	return {
		following: following,
		followed:followed
	}
}

function getCounters(req, res){
	var userId = req.user.sub;
	if(req.params.id){
		userId = req.params.id;
	}
	getCountFollow(userId).then((value) => {
		return res.status(200).send(value);
	});

}

async function getCountFollow(user_id){
	var following = await Follow.count({"user":user_id}).exec().then((count) => {
		
		return count;
	}).catch((err) => {
        return 0;
	});

	var followed = await Follow.count({"followed":user_id}).exec().then((count) => {
		
		return count;
	}).catch((err) => {
        return 0;
	});

	var publications = await Publication.count({"user": user_id}).exec().then((count) => {
		return count;
	}).catch((err) => {
		return 0;
	});

	return {
		following,
		followed,
		publications
	};
}

//Edición datos de usuario
function updateUser(req,res){
	var userId = req.params.id;
	var update = req.body;

	// Borrar propiedad password
	delete update.password;
	if(userId != req.user.sub) return res.status(500).send({
			message: 'No tienes permiso para actualizar los datos del usuario'
	});
	if(req.body.email && req.body.nick){
		User.find({ $or: [
					{email: req.body.email.toLowerCase()},
					{nick: req.body.nick.toLowerCase()}
				]}).exec((err, users) => {
					if(err) return res.status(500).send({message:'Error en la petición de usuarios'});
					if( users.length == 1 && users[0]._id != req.user.sub|| users.length > 1){
						return res.status(200).send({
							message:'El email o el nick que intentas actualizar ya existe',
							email: req.user.email,
							nick: req.user.nick,
						});
					}else{
						User.findByIdAndUpdate(userId, update, {new: true}, (err, userUpdated) => {
							if(err) return res.status(500).send({
								message: 'Error en la petición'
							});

							if(!userUpdated) return res.status(500).send({
									message: 'No se ha podido actualizar al usuario'
							});
							userUpdated.password = undefined;
							return res.status(200).send({user: userUpdated});
									
						});
					}
				});
	}
}

//Subir archivos de imagen/avatar de usuario
function uploadImage(req,res){
	var userId = req.params.id;


	if(req.files){
		var file_path = req.files.image.path;
		//console.log(file_path);
		var file_split = file_path.split('/');
		//console.log(file_split);
		var file_name = file_split[2];
		//console.log(file_name);
		var ext_split = file_name.split('\.');
		//console.log(ext_split);
		var file_ext = ext_split[1];

		if(userId != req.user.sub){ 
			removeFilesofUploads(res, file_path, 'No tienes permisos para modificar la información del usuario');
		}else{

			if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif'){
				
				//Unlink y actualización de user.image
				User.findById(userId, (err, user) => {
					
					//Actualizar documento de usuario logueado
					User.findByIdAndUpdate(userId, {image: file_name}, {new:true},(err,userUpdated) => {
						if(err) return res.status(500).send({
							message: 'Error en la petición'
						});

						if(!userUpdated) return res.status(500).send({
								message: 'No se ha podido actualizar al usuario'
						});
						userUpdated.password = undefined;
						if(user.image){
							
							fs.unlink('./uploads/users/' + user.image, (err) => {

							});
						}
						return res.status(200).send({user: userUpdated});
					});
				});

			}else{
				removeFilesofUploads(res, file_path, 'Extensión no válida');
			}
		}

	}else{
		return res.status(200).send({message: 'No se han subido archivos o imágenes'});
	}
}

function removeFilesofUploads(res,file_path, err_message){
	fs.unlink(file_path, (err) => {
		return res.status(200).send({
			message: err_message
		});
	});
}

function getImageFile(req, res){
	var image_file = req.params.imageFile;
	var path_file = './uploads/users/' + image_file;
	

	fs.exists(path_file, (exists) => {
		if(exists){
			res.sendFile(path.resolve(path_file));
		}else{
			res.status(200).send({
				message: 'No existe la imagen'
			});
		}
	});
}

module.exports = {
	home,
	pruebas,
	saveUser,
	loginUser,
	getUser,
	getUsers,
	getCounters,
	updateUser,
	uploadImage,
	getImageFile

}

