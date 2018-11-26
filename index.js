const admin = require('firebase-admin')
var fs = require('fs')
const Json2csvTransform = require('json2csv').Transform;
const exec = require('child_process').exec
 
const fields = ['study', 'time', 'sketch', 'user', 'type', 'operation', 'strokes', 'path', 'color'];
const opts = { fields };
const transformOpts = { highWaterMark: 16384, encoding: 'utf-8' };

var serviceAccount = require('./ebauche-logging-firebase-adminsdk-15e85-af1cffccee.json');

let studyExports = {
  pilot1 : [
    'sketch-badger-875',
    'sketch-dinosaur-261',
    'sketch-guinea-pig-934',
    'sketch-hawk-267',
    'sketch-human-456',
    'sketch-ibis-69',
    'sketch-oryx-297',
    'sketch-starling-518',
    'sketch-swallow-538'
  ],
  pilot2 : [
    'sketch-curlew-291',
    'sketch-duck-735',
    'sketch-hawk-267',
    'sketch-hedgehog-912',
    'sketch-mantis-850',
    'sketch-meerkat-436',
    'sketch-rhinoceros-112'
  ],
  pilot3 : [
    'sketch-cattle-668',
    'sketch-horse-885',
    'sketch-woodpecker-122',
    'sketch-starling-255',
    'sketch-viper-442'
  ],
  pilot4 : [
    'sketch-swan-527',
    'sketch-moose-595',
    'sketch-wasp-193',
    'sketch-heron-300',
    'sketch-quetzal-46',
    'sketch-ibis-467',
    'sketch-kangaroo-353',
    'sketch-lapwing-78',
    'sketch-jay-830',
    'sketch-heron-523',
    'sketch-anteater-854',
    'sketch-donkey-664',
    'sketch-wolverine-636',
    'sketch-owl-457'
  ]
}

let docs = []

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

var db = admin.firestore();
//Date Object change compaitbility
const settings = {/* your settings... */ timestampsInSnapshots: true}
db.settings(settings)

for(var key in studyExports){
  let studyPromises = []
  studyExports[key].forEach((sketchId) => {
    console.log('Starting export of sketch :'+ sketchId +' from study : '+key)
    studyPromises.push( db.collection(sketchId).get()
    .then(snap => {
      let prevLength = 0
      for(doc of snap.docs) {
        if(doc.data().type === 'screenshot') {
          if(prevLength != doc.data().path.length) {
            saveScreenshot(doc.data().path, `${sketchId}-${doc.id}`, key)
            prevLength = doc.data().path.length
          }
          continue
        }
        let tmpData = doc.data()
        tmpData.sketch = sketchId
        tmpData.study = key
        tmpData.time = doc.id
        docs.push(tmpData)
      }
    })
    .catch(err => {
      console.log('Err : ', err)
    }))
  })
  Promise.all(studyPromises)
    .then(() => {
      docs.sort((a, b) => {
        return a.time - b.time
      })

      let docsJson = JSON.stringify(docs)

      fs.writeFileSync(`${key}.json`, docsJson, 'utf8')
      
      const input = fs.createReadStream(`${key}.json`, { encoding: 'utf8' });
      const output = fs.createWriteStream(`${key}.csv`, { encoding: 'utf8' });
      const json2csv = new Json2csvTransform(opts, transformOpts);

      const processor = input.pipe(json2csv).pipe(output);
      
      json2csv
        .on('header', header => console.log(header))
        .on('error', err => console.log(err));

    })
}

function saveScreenshot(svgString, filename, study) {
  let cleaned = svgString.replace('xmlns:xlink=""', ' ')
  cleaned = cleaned.replace('<svg ', '<svg width="1920" height="1920" ')
  if(cleaned.length <= 140) return

  if(!fs.existsSync(`./${study}-tmp`)) {
    fs.mkdirSync(`./${study}-tmp`)
  }
  if(!fs.existsSync(`./${study}-screen`)) {
    fs.mkdirSync(`./${study}-screen`)
  }
  fs.writeFile(`./${study}-tmp/${filename}.svg`, cleaned, (err) => {
    if(!err) {
      // This is a call to ImageMagick utility
      exec(`convert ./${study}-tmp/${filename}.svg ./${study}-screen/${filename}.png`, (err, stdout, stdin) => {
        if(err) {
          console.error(`Exec error : ${err}`)
        }
      })
    }
  })
}