# Multer Depolama Motoru

Depolama motorları, iki işlevi açığa çıkaran sınıflardır: `_handleFile` ve `_removeFile`.
Kendi özel depolama motorunuzla başlamak için aşağıdaki şablonu izleyin.

Kullanıcıdan girdi isterken (örneğin bu dosyanın nereye kaydedileceği gibi), her zaman
onlara `req, file, cb` parametrelerini bu sırayla verin. Bu, geliştiricilerin depolama motorları arasında geçiş yapmasını kolaylaştırır.

Örneğin, aşağıdaki şablonda, motor dosyaları diske kaydeder. Kullanıcı, motora dosyayı nereye kaydedeceğini söyler ve bu, `destination` parametresini sağlayarak yapılır:

```javascript
var storage = myCustomStorage({
destination: function (req, file, cb) {
cb(null, '/var/www/uploads/' + file.originalname)
}
})
```

Motorunuz dosyayı depolamak ve gelecekte dosyaya nasıl erişileceğine dair bilgileri döndürmekten sorumludur. Bu, `_handleFile` işlevi tarafından yapılır.

Dosya verileri size bir akış (`file.stream`) olarak verilecektir. Bu verileri bir yere iletmelisiniz ve işiniz bittiğinde, dosyayla ilgili bazı bilgilerle `cb`yi çağırmalısınız.

Geri aramada sağladığınız bilgiler multer'ın dosya nesnesiyle birleştirilecek ve ardından `req.files` aracılığıyla kullanıcıya sunulacaktır.

Motorunuz ayrıca daha sonra bir hatayla karşılaşıldığında dosyaları kaldırmaktan da sorumludur. Multer hangi dosyaların ne zaman silineceğine karar verecektir. Depolama sınıfınız `_removeFile` işlevini uygulamalıdır. `_handleFile` ile aynı argümanları alacaktır. Dosya kaldırıldıktan sonra geri aramayı çağırın.

## Şablon

```javascript
var fs = require('fs')

getDestination işlevi (req, dosya, cb) {
cb(null, '/dev/null')
}

MyCustomStorage işlevi (opts) {
this.getDestination = (opts.destination || getDestination)
}

MyCustomStorage.prototype._handleFile = _handleFile işlevi (req, dosya, cb) {
this.getDestination(req, dosya, işlev (err, yol) {
if (err) return cb(err)

var outStream = fs.createWriteStream(path)

file.stream.pipe(outStream)
outStream.on('error', cb)
outStream.on('finish', işlev () {
cb(null, {
yol: yol,
boyut: outStream.bytesWritten
})
})
})
}

MyCustomStorage.prototype._removeFile = function _removeFile (req, file, cb) {
fs.unlink(file.path, cb)
}

module.exports = function (opts) {
return new MyCustomStorage(opts)
}
```