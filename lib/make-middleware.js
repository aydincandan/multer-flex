var is = require('type-is')
var Busboy = require('busboy')
var extend = require('xtend')
var appendField = require('append-field')

var Counter = require('./counter')
var MulterError = require('./multer-error')
var FileAppender = require('./file-appender')
var removeUploadedFiles = require('./remove-uploaded-files')

function makeMiddleware(setup) {
  return function multerMiddleware(req, res, next) {
    if (!is(req, ['multipart'])) return next()

    var options = setup()

    var limits = options.limits
    var storage = options.storage
    var fileFilter = options.fileFilter
    var fileStrategy = options.fileStrategy
    var preservePath = options.preservePath
    var verbose = options.verbose

    req.body = Object.create(null)

    var busboy

    try {
      busboy = Busboy({ headers: req.headers, limits: limits, preservePath: preservePath })
    } catch (err) {
      return next(err)
    }

    var appender = new FileAppender(fileStrategy, req)
    var isDone = false
    var readFinished = false
    var errorOccured = false
    var pendingWrites = new Counter()
    var uploadedFiles = []

    function done(err) {
      // console.log("node_modules/multer-flex => done(err)", { isDone })
      if (isDone) return
      isDone = true
      req.unpipe(busboy)
      busboy.removeAllListeners()
      // console.log("node_modules/multer-flex => function done(err) CALL...",)
      next(err)
    }
    // busboy için de bu stream cancel nasıl gerçekleşir : https://chatgpt.com/share/f7df9b63-50f7-4b6d-b411-bfcacaf94631
    function cancelBusboy(busboy, file, reason) {
      // Akışı durdur
      // file.unpipe();
      // file.destroy(new MulterError(reason));
      // busboy.destroy();
      done(reason)
    }

    function indicateDone(myarg) {
      // console.log("node_modules/multer-flex => function indicateDone() CALL...", myarg)
      if (readFinished && pendingWrites.isZero() && !errorOccured) done()
    }

    function abortWithError(uploadError) {
      if (errorOccured) return
      errorOccured = true

      pendingWrites.onceZero(function () {
        function remove(file, cb) {
          storage._removeFile(req, file, cb)
        }

        removeUploadedFiles(uploadedFiles, remove, function (err, storageErrors) {
          if (err) return done(err)

          uploadError.storageErrors = storageErrors
          done(uploadError)
        })
      })
    }

    function abortWithCode(code, optionalField) {
      // console.log("node_modules/multer-flex => abortWithCode(code, optionalField)", { code, optionalField })
      abortWithError(new MulterError(code, optionalField))
    }

    // handle text field data
    busboy.on('field', function (fieldname, value, { nameTruncated, valueTruncated }) {
      if (fieldname == null) return abortWithCode('MISSING_FIELD_NAME')
      if (nameTruncated) return abortWithCode('LIMIT_FIELD_KEY')
      if (valueTruncated) return abortWithCode('LIMIT_FIELD_VALUE', fieldname)

      // Work around bug in Busboy (https://github.com/mscdex/busboy/issues/6)
      if (limits && Object.prototype.hasOwnProperty.call(limits, 'fieldNameSize')) {
        if (fieldname.length > limits.fieldNameSize) return abortWithCode('LIMIT_FIELD_KEY')
      }

      appendField(req.body, fieldname, value)
    })

    // handle files
    busboy.on('file', function (fieldname, fileStream, { filename, encoding, mimeType }) {
      // console.log({ filename })
      // don't attach to the files object, if there is no file
      if (!filename) return fileStream.resume()

      fileStream.on('data', (data) => {
        if (verbose)
          console.log("node_modules/multer-flex => fileStream.on('data'", ` [${fieldname}] DATA. ${data.length} bytes`);

        // Belirli bir koşulda iptal etmek isterseniz
        // if (data.length > 1024 * 1024) { // Örnek: 1MB'yi aşarsa iptal et
        // setTimeout(() => {
        //   cancelBusboy(busboy, fileStream, new MulterError('ISTENMEYEN_DOSYA_TIPI', 'timeout cancel -' + fieldname));
        // }, 1000);
        // }
      })

      // Work around bug in Busboy (https://github.com/mscdex/busboy/issues/6)
      if (limits && Object.prototype.hasOwnProperty.call(limits, 'fieldNameSize')) {
        if (fieldname.length > limits.fieldNameSize) return abortWithCode('LIMIT_FIELD_KEY')
      }

      var file = {
        multerFlexVer: 1.2,
        fieldname: fieldname,
        originalname: filename,
        encoding: encoding,
        mimetype: mimeType
      }

      var placeholder = appender.insertPlaceholder(file)

      //function(req, file, cbnext)
      fileFilter(req, file, function (err, file_accept) { // (err, includeFile)
        // // eski yeri (line:118)
        // if (err) {
        //   appender.removePlaceholder(placeholder)
        //   return abortWithError(err)
        // }
        // // eski yeri (line:118)

        if (!file_accept) { // if (!includeFile)
          // appender.removePlaceholder(placeholder) // evet bu böyle kalacak

          // ########################################
          placeholder.reason = err // BU BİZİ KURTARDI
          delete placeholder.fieldname
          // ########################################

          console.log("node_modules/multer-flex => 0 0 0 0 0 0 0 0 0 0 0 0 DOSYA RED EDILDI 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0", err, file_accept)

          // burada file stream i cancel et ki BEKLEMEYELİM 
          // fileStream.destroy(); // OLMADI 
          // done(err); // OLMADI 
          // busboy.emit('close'); // OLMADI
          // busboy.emit('deneme'); // OLMADI

          // abortWithError(err)
          // console.log("node_modules/multer-flex => ", err.code, fieldname)
          // abortWithCode(err.code, fieldname)

          // file.deneme = "ok"
          // uploadedFiles.push(file)

          // return fileStream.resume() // [orijinal satır] bu olsa bile dosyanın büyüklüğü kadar bekliyoruz ?
          return // böyle olunca da dosyanın büyüklüğü kadar bekliyoruz ?
        }

        console.log("node_modules/multer-flex => 0 0 0 0 0 0 0 0 0 0 0 0 DOSYA KABUL EDILDI 0 0 0 0 0 0 0 0 0 0 0 0 0 0", err, file_accept)

        // yeni yeri (line:118)
        if (err) {
          // oha kaldırdık iyi oldu
          // appender.removePlaceholder(placeholder)
          // console.log("?????????????????????????????????????????????????????????????????????")
          // return abortWithError(err)
          // oha kaldırdık iyi oldu
        }
        // yeni yeri (line:118)


        var aborting = false
        pendingWrites.increment()

        Object.defineProperty(file, 'stream', {
          configurable: true,
          enumerable: false,
          value: fileStream
        })

        fileStream.on('error', function (err) {
          pendingWrites.decrement()
          abortWithError(err)
        })

        fileStream.on('limit', function () {
          aborting = true
          abortWithCode('LIMIT_FILE_SIZE', fieldname)
        })

        storage._handleFile(req, file, function (err, info) {
          if (aborting) {
            appender.removePlaceholder(placeholder)
            uploadedFiles.push(extend(file, info))
            return pendingWrites.decrement()
          }

          if (err) {
            appender.removePlaceholder(placeholder)
            pendingWrites.decrement()
            return abortWithError(err)
          }

          var fileInfo = extend(file, info)

          appender.replacePlaceholder(placeholder, fileInfo)
          uploadedFiles.push(fileInfo)
          pendingWrites.decrement()
          indicateDone({ izah: "* busboy on close sonrasi storage._handleFile *", file, err, info })
        })
      })
    })

    busboy.on('error', function (err) {
      console.log("* busboy on error *", err)
      abortWithError(err)
    })
    busboy.on('deneme', function () { abortWithCode('ISTENMEYEN_DOSYA_TIPI', "xfieldname") }) // busboy.emit('deneme');  ile çalışıyor
    busboy.on('partsLimit', function () { abortWithCode('LIMIT_PART_COUNT') })
    busboy.on('filesLimit', function () { abortWithCode('LIMIT_FILE_COUNT') })
    busboy.on('fieldsLimit', function () { abortWithCode('LIMIT_FIELD_COUNT') })
    busboy.on('close', function () {
      readFinished = true
      indicateDone({ izah: "* busboy on close *", readFinished, errorOccured, pendingWrites, uploadedFiles })
    })

    req.pipe(busboy)
  }

}

module.exports = makeMiddleware
