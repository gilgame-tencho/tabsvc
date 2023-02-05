const fs = require('fs');
const path = require('path');
const fl = require('node-filelist');
const {exec} = require('child_process');
const { program } = require("commander");
const zip = require('node-zip');
const archiver = require('archiver');
const { arch } = require('os');

// const PWD = process.env.PWD;
const ws_name = 'ws';
const svc_name = 'svc';
// tmp tableau_dev_tool/.
const option = {"ext": "tfl"};
const target_name = "target_param.json";

const WS = path.join(__dirname, ws_name);
const ROOT = path.basename(__dirname);
const SVC = path.join(__dirname, svc_name);

const target = JSON.parse(fs.readFileSync(path.join(__dirname, target_name)));

const input_con = target.nodes.any_if1.convert;
function conv_input(obj){
    var conv = input_con;
    obj.nodeType = conv.nodeType;
    obj.name = "TEST_IN 抽出 (input)";
    obj.connectionAttributes = conv.connectionAttributes;
    // obj.connectionAttributes.dbname = conv.connectionAttributes.dbname;
    // obj.projectName = conv.connectionAttributes.projectName;
    // obj.connectionAttributes.datasourceName = conv.connectionAttributes.datasourceName;
    obj.relation.table = conv.relation.table;
}
const output_con = target.nodes.any_if2.convert;
function conv_output(obj){
    var conv = output_con;
    obj.nodeType = conv.nodeType;
    obj.projectName = conv.projectName;
    obj.projectLuid = conv.projectLuid;
    obj.datasourceName = conv.datasourceName;
    obj.datasourceDescription = conv.datasourceDescription;
    obj.serverUrl = conv.serverUrl;

    delete obj.hyperOutputFile;
    delete obj.tdsOutput;
}

// const zip_output = fs.createWriteStream('./example.zip');
const archive = archiver('zip', {
  zlib: { level: 9 }
});

function zip2(){
    var zip_output = fs.createWriteStream('./example.zip');
    // pipe archive data to the file
    archive.pipe(zip_output);
    // append files from a sub-directory, putting its contents at the root of archive
    archive.directory('svc/pg/hogehoge.tfl/', false);

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
    zip_output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the zip_output file descriptor has closed.');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            console.log('Warning: ', err);
        } else {
            throw err;
        }
    });
    
    // good practice to catch this error explicitly
    archive.on('error', function(err) {
        throw err;
    });
    
    // call finalize method to finalize the archive
    archive.finalize();
}

function test(){
    var smp = path.join(__dirname, "svc", "pg", "hogehoge.tfl", "flow");
    console.log(smp);
    var flow = JSON.parse(fs.readFileSync(smp, 'utf-8'));
    var in_nodes = [];
    var out_nodes = [];
    var nodes = Object.keys(flow.nodes);
    console.log(nodes);
    for(var i=0; i<nodes.length; i++){
        var key = nodes[i];
        var obj = flow.nodes[key];
        console.log(key);
        console.log(obj.baseType);
        if(obj.baseType === 'input'){
            console.log('input exec.');
            conv_input(obj);
            // console.log(obj);
        }else if(obj.baseType === 'output'){
            console.log('output exec.');
            conv_output(obj);
            console.log(obj);
        }
    }
}

function what_params(){    
    console.log(WS);
    console.log(ROOT);
    console.log(option);
}

function path_parse(path){
    var res = {};
    res.path = path;
    res.order = path.split('\\');
    res.root_index = res.order.findIndex(element => element === ROOT) + 2;
    res.ws_order = res.order.concat().slice(res.root_index, res.order.length - 1);

    var tmp_order = res.order.concat();
    tmp_order.splice(res.root_index - 1, 1, svc_name);
    res.svc_path = tmp_order.join('\\');

    res.name = res.order[res.order.length -1];
    res.base_name = res.name.replace('.'+option.ext, '');
    res.root = res.order[0];
    return res;
}

function main_init(){
    console.log('init function is comming soon!!');
}

function main_decompose(){
    fl.read([WS], option, function(rs){
        for(var i=0; i<rs.length; i++){
            var file = rs[i];
            // console.log(file);
            var item = path_parse(file.path);
            // console.log(item);
    
            var wdir = svc_name;
            for(var j=0; j<item.ws_order.length; j++){
                wdir = path.join(wdir, item.ws_order[j]);
                if (!fs.existsSync(wdir)) {
                    fs.mkdirSync(wdir);
                }
            }
            wdir = path.join(wdir, item.name);
            if (!fs.existsSync(wdir)) {
                fs.mkdirSync(wdir);
            }
            exec('unzip -o ' + item.path + ' -d ' + item.svc_path, (err, stdout, stderr) => {
                if (err) { throw err }
                console.log(`stdout: ${stdout}`);
            });
        }
    });
}

function main_status(){
    console.log(SVC);
    exec('cd ' + __dirname);
    exec('bash bin/git_status.sh', (err, stdout, stderr) => {
        if (err) { throw err }
        console.log(`${stdout}`);
    });
}

function main_commit(){
    console.log(SVC);
    exec('cd ' + __dirname);
    exec('bash bin/git_commit.sh', (err, stdout, stderr) => {
        if (err) { console.log(stderr); throw err }
        console.log(`${stdout}`);
    });
}

function main_deploy(){
    console.log('comming soon. deploy!!');
}

program
  .name('tableau src vertion control')
  .version('0.0.1', '-v, --version, version')
  .option("-h, --help, help", "Show help.")

program.command('init')
  .description('git repo init.')
  .action((str, options)=> {
    main_init();
});

program.command('decompose')
  .description('ws prep files to svc file decompose.')
  .alias('d')
  .action((str, options)=> {
    main_decompose();
});

program.command('commit')
  .description('git commit.')
  .alias('c')
  .action((str, options)=> {
    main_commit();
});

program.command('status')
  .description('git status.')
  .alias('s')
  .action((str, options)=> {
    main_status();
});

program.command('deploy')
  .description('samthing enviroment prep deployment. at deploy.conf')
  .argument('[env]', 'deploy enviroment.')
  .alias('d')
  .action((str, options)=> {
    main_deploy();
});

program.command('dev')
  .description('show dev parameters')
  .action((str, options)=> {
    what_params();
    // test();
    // zipFiles();
    zip2();
});

program.parse();

if (process.argv.length < 3) {
  program.help();
}
