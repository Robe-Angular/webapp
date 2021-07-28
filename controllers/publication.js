'use strict'

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');

var Publication = require('../models/publication');
var User = require('../models/user');
var Follow = require('../models/follow');

function probando(req, res){
	res.status(200).send({
			message:"Hola desde el controlador de publicaciones"
	});
}

function savePublication(req, res){
	var params = req.body;	
	if(!params.text) return res.status(200).send({message:'Debes enviar un texto'});
	var publication = new Publication();
	publication.text = params.text;
	publication.file = 'null';
	publication.user = req.user.sub;
	publication.created_at = moment().unix();
	publication.save((err, publicationStored) => {
		if(err) return res.status(500).send({message: 'Error al guardar la publicación'});
		if(!publicationStored) return res.status(404).send({message: 'La publicación no ha sido guardada'});
		return res.status(200).send({publication:publicationStored});
	})
}

function getPublications(req, res){
	var page = 1;
	if(req.params.page){
		page = req.params.page;
	}
	var itemsPerPage = 4;

	Follow.find({user: req.user.sub}).populate('followed').exec((err, follows) => {
		if(err) return res.status(500).send({message:'Error al devolver el serguimiento'});
		var follows_clean = [];
		follows.forEach(follow => {
			follows_clean.push(follow.followed);

		});
		follows_clean.push(req.user.sub);
		Publication.find({user: {"$in": follows_clean}}).sort('-created_at').populate('user').paginate(page, itemsPerPage, (err, publications, total) => {
			if(err) return res.status(500).send({message:'Error al devolver publicaciones'});
		
			if(!publications) return  res.status(404).send({message: 'No hay publicaiones'});
			publications.forEach( publication =>  {
				if(publication.user.password){
					publication.user.password = undefined;
				}
			});
			return res.status(200).send({
				total_items: total,
				pages: Math.ceil(total/itemsPerPage),
				page,
				items_per_page: itemsPerPage,
				publications
			});
		});
	});
}

function getPublicationsUser(req, res){
	var page = 1;
	if(req.params.page){
		page = req.params.page;
	}
	var itemsPerPage = 4;
	var user_id = req.user.sub;
	if(req.params.id){
		var user_id = req.params.id;	
	}
	

	Publication.find({user: user_id}).sort('-created_at').populate('user').paginate(page, itemsPerPage, (err, publications, total) => {
		if(err) return res.status(500).send({message:'Error al devolver publicaciones'});
	
		if(!publications) return  res.status(404).send({message: 'No hay publicaiones'});
		publications.forEach( publication =>  {
			if(publication.user.password){
				publication.user.password = undefined;
			}
		});
		return res.status(200).send({
			total_items: total,
			pages: Math.ceil(total/itemsPerPage),
			page,
			items_per_page: itemsPerPage,
			publications
		});
	});
	
}

function getPublication(req, res){
	var publicationId = req.params.id;

	Publication.findById(publicationId).populate('user').exec((err, publication) => {
		if(err) return res.status(500).send({message:'Error al devolver publicación'});
		if(!publication) return res.status(404).send({message:'No existe la publicación'});
		if(publication.user.password){
			publication.user.password = undefined;
		}

		res.status(200).send({
			publication
		});
	})
}

function deletePublication(req,res){
	var publicationId = req.params.id;
	Publication.findById(publicationId, (err, publication) => {
		Publication.find({user:req.user.sub, '_id': publicationId}).remove((err, publicationRemoved) => {
			if(err) return res.status(500).send({message:'Error al eliminar publicación'});
			if(!publicationRemoved) return res.status(404).send({message:'No existe la publicación'});
			if(publicationRemoved.deletedCount == 0){
				return res.status(404).send({message:'No existe la publicación'});
			}
			console.log(publication);
			if(publication.file){
				console.log(publication);
				fs.unlink('./uploads/publications/' + publication.file, (err) => {

				});
			}

			return res.status(200).send({publication: publicationRemoved});
		});
	});
}

function uploadImage(req,res){
	var publicationId = req.params.id;

	console.log('files');
	if(req.files){
		var file_path = req.files.image.path;
		console.log('files');
		//console.log(file_path);
		var file_split = file_path.split('/');
		//console.log(file_split);
		var file_name = file_split[2];
		//console.log(file_name);
		var ext_split = file_name.split('\.');
		//console.log(ext_split);
		var file_ext = ext_split[1];

	
		if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif'){
			
			//Unlink y actualización de publication.image
			Publication.findById(publicationId, (err, publication) => {
				if(publication.user != req.user.sub){
					return res.status(500).send({
						message: 'No tienes permisos para modificar la publicación'
					});

				}
				//Actualizar documento de publicación
				Publication.findByIdAndUpdate(publicationId, {file: file_name}, {new:true},(err,publicationUpdated) => {
					if(err) return res.status(500).send({
						message: 'Error en la petición'
					});

					if(!publicationUpdated) return res.status(500).send({
							message: 'No se ha podido actualizar al usuario'
					});
					if(publication.file){
						
						fs.unlink('./uploads/publications/' + publication.file, (err) => {

						});
					}
					return res.status(200).send({publication: publicationUpdated});
				});
			});

		}else{
			removeFilesofUploads(res, file_path, 'Extensión no válida');
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
	var path_file = './uploads/publications/' + image_file;
	

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
	probando,
	savePublication,
	getPublications,
	getPublicationsUser,
	getPublication,
	deletePublication,
	uploadImage,
	getImageFile

}