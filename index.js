/**
 * Bu dosya, bir görseli Google Cloud Storage'a yükleyip, 
 * Vertex AI kullanarak görsel analizi yapan bir Node.js uygulamasını içerir.
 * 
 * Adımlar:
 * 1. Google Cloud Storage'da bir bucket oluşturur veya mevcutsa kullanır.
 * 2. Belirtilen dosyayı bu bucketa yükler.
 * 3. Yüklenen dosyanın URI'sini alır.
 * 4. Vertex AI kullanarak görsel analizi yapar ve sonuçları konsola yazdırır.
 * 
 * Gerekli kütüphaneler:
 * - @google-cloud/storage: Google Cloud Storage için
 * - @google-cloud/vertexai: Vertex AI için
 * 
 * Gerekli değişkenler:
 * - project: Google Cloud Proje ID
 * - location: Google Cloud Konumu
 * - bucketName: Oluşturulacak veya kullanılacak bucket adı
 * - storageClass: Depolama sınıfı (örneğin, 'STANDARD')
 * - filePath: Yüklenecek dosyanın yolu
 * 
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
const { Storage } = require('@google-cloud/storage');
const { VertexAI } = require('@google-cloud/vertexai');

// Google Cloud Proje ID ve Konum
const project = 'vertexaimrc'; // Mevcut projemiz
const location = 'us-central1'; 
const storage = new Storage({ projectId: project });
const vertexAI = new VertexAI({ project: project, location: location });



const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 8000;

// Multer yapılandırması: Dosyaları 'uploads' klasörüne kaydet
const storagelocal = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storagelocal });
app.get("/",async (req, res) => {
  res.send("Google VertexAI Bridge Ayakta")
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('Dosya yüklenmedi.');
    }
    await sleep(1000);
    let ress={}

    const bucketName = 'vertexaimrc-photos'; 
    const storageClass = 'STANDARD'; 
    const filePath = __dirname + `/uploads/${req.file.filename}` // Path
  
  
    const createdBucket = await createBucketIfNotExists(bucketName, storageClass, location);
  
   
    const gcsUri = await uploadFile(createdBucket, filePath);
  
  
    if (gcsUri) {
    ress =  await analyzeImage(gcsUri);
    res.send(ress);
    }
    else{
      throw "analiz yapılmadı";
    }

    
  } catch (error) {
    console.error('Dosya yükleme hatası:', error.message);
    res.status(500).send('Sunucuda bir hata oluştu.');
  }
});

// Statik dosyalar için uploads klasörünü kullanıma aç
app.use('/uploads', express.static('uploads'));

// Server başlat
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});


async function createBucketIfNotExists(bucketName, storageClass, location) {
  try {
    const [buckets] = await storage.getBuckets();
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);

    if (bucketExists) {
      console.log(`Bucket '${bucketName}' zaten mevcut.`);
      return bucketName;
    }

    const [bucket] = await storage.createBucket(bucketName, {
      location: location,
      storageClass: storageClass,
    });
    console.log(`Bucket '${bucketName}' başarıyla oluşturuldu!`);
    return bucketName;
  } catch (error) {
    console.error('Bucket oluşturulurken hata oluştu:', error.message);
  }
}


async function uploadFile(bucketName, filePath) {
  try {
    const [file] = await storage.bucket(bucketName).upload(filePath);
    console.log(`Dosya başarıyla yüklendi: ${filePath}`);
    return `gs://${bucketName}/${file.name}`;
  } catch (error) {
    console.error('Dosya yüklenirken hata oluştu:', error.message);
  }
}


async function analyzeImage(gcsUri) {
  try {
    const generativeVisionModel = vertexAI.getGenerativeModel({
      model: 'gemini-1.0-pro-vision',
    });

    const request = {
      contents: [
        { role: 'user', parts: [{ text: 'What is this picture about?' }, { fileData: { fileUri: gcsUri, mimeType: 'image/jpeg' } }] },
      ],
    };

    const streamingResult = await generativeVisionModel.generateContentStream(request);
    console.log('Görsel analizi sonuçları:');
    for await (const item of streamingResult.stream) {
      console.log('Akış Parçası: ', JSON.stringify(item));
    }
    const aggregatedResponse = await streamingResult.response;
    console.log('Sonuç: ', aggregatedResponse.candidates[0].content.parts[0].text);
    return aggregatedResponse;
  } catch (error) {
    console.error('Görsel analizi yapılırken hata oluştu:', error.message);
  }
}

// Ana fonksiyon
// (async function main() {
//   const bucketName = 'vertexaimrc-photos'; 
//   const storageClass = 'STANDARD'; 
//   const filePath = 'tablo.jpg'; // Path


//   const createdBucket = await createBucketIfNotExists(bucketName, storageClass, location);

 
//   const gcsUri = await uploadFile(createdBucket, filePath);


//   if (gcsUri) {
//     await analyzeImage(gcsUri);
//   }
// })();
