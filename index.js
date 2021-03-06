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
  ],
  groupA : [
    'sketch-horse-3565',
    'sketch-quail-2536',
    'sketch-louse-9620',
    'sketch-walrus-6760',
    'sketch-chimpanzee-9514',
    'sketch-otter-5021',
    'sketch-ibis-3008',
    'sketch-caribou-1240',
    'sketch-hyena-9734',
    'sketch-monkey-9968'
  ],
  groupB : [
    'sketch-komodo-dragon-4302',
    'sketch-butterfly-7051',
    'sketch-falcon-3442',
    'sketch-caribou-7946',
    'sketch-badger-3697'
  ],
  groupE : [
    'sketch-caribou-4613',
    'sketch-turtle-7405',
    'sketch-panther-8286',
    'sketch-hippopotamus-2972',
    'sketch-vicuña-814',
    'sketch-woodpecker-8020'
  ],
  groupG: [
    'sketch-stingray-5600',
    'sketch-caterpillar-2755',
    'sketch-raccoon-6165',
    'sketch-sandpiper-9775',
    'sketch-armadillo-7836',
    'sketch-stork-3817',
    'sketch-duck-5510',
    'sketch-sparrow-3156'
  ],
  groupH : [
    'sketch-stingray-5600',
    'sketch-caterpillar-2755',
    'sketch-raccoon-6165',
    'sketch-sandpiper-9775',
    'sketch-armadillo-7836',
    'sketch-stork-3817',
    'sketch-duck-5510',
    'sketch-sparrow-3156'
  ],
  groupC : [
    'sketch-elephant-1644',
    'sketch-bear-9939',
    'sketch-goat-6470',
    'sketch-leopard-6392',
    'sketch-ostrich-466',
    'sketch-wren-2121',
    'sketch-fish-2257',
    'sketch-stork-3',
    'sketch-cheetah-4472',
    'sketch-hawk-5824'
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

async function exportTask() {
  for(var key in studyExports){
    for(let sketchId of studyExports[key]){
      console.log('Starting export of sketch :'+ sketchId +' from study : '+key)
      await db.collection(sketchId).get()
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
        })
    }

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
  }
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

exportTask()