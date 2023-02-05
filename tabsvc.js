const fs = require('fs');
const path = require('path');
const fl = require('node-filelist');
const {exec} = require('child_process');
const { program } = require("commander");
const archiver = require('archiver');
const fse = require('fs-extra');

const ws_name = 'ws';
const svc_name = 'svc';
const option = {"ext": "tfl"};
const target_name = "target_param.json";
const deploy_conf_name = "deploy.json";

const WS = path.join(__dirname, ws_name);
const ROOT = path.basename(__dirname);
const SVC = path.join(__dirname, svc_name);
const DEPLOY = path.join(__dirname, "deployment");

const target = JSON.parse(fs.readFileSync(path.join(__dirname, target_name)));
const deploy_conf = JSON.parse(fs.readFileSync(path.join(__dirname, deploy_conf_name)));

const input_con = target.nodes.any_if1.convert;
function conv_input(obj, connection_id){
    var conv = input_con;
    obj.nodeType = conv.nodeType;
    obj.name = "TEST_IN 抽出 (input)";
    obj.connectionAttributes = conv.connectionAttributes;
    obj.connectionAttributes.dbname = "TEST_IN";
    // obj.projectName = conv.connectionAttributes.projectName;
    obj.connectionAttributes.datasourceName = "TEST_IN 抽出";

    obj.relation.table = conv.relation.table;
    obj.connectionId = connection_id;
}

const output_con = target.nodes.any_if2.convert;
function conv_output(obj, connection_id){
    var conv = output_con;
    obj.nodeType = conv.nodeType;
    obj.projectName = conv.projectName;
    // obj.projectLuid = conv.projectLuid;
    obj.projectLuid = "447b9453-3507-4cd3-b936-25258f9ac360";
    // obj.datasourceName = conv.datasourceName;
    obj.datasourceName = "TEST_OUT2";
    obj.datasourceDescription = conv.datasourceDescription;
    // obj.serverUrl = conv.serverUrl;
    obj.serverUrl = "https://prod-apnortheast-a.online.tableau.com/#/site/fjdemosite";

    delete obj.hyperOutputFile;
    delete obj.tdsOutput;
}

const connection_con = target.connections;
function conv_connections(obj){
    var conv = connection_con;
    var keys = Object.keys(obj.connections);
    var ids = keys.shift();
    obj.connections = {};
    obj.connections[ids] = conv;
    obj.connections[ids].id = ids;
    obj.connections[ids].name = "https://prod-apnortheast-a.online.tableau.com (FJ_DemoSite)";
    obj.connections[ids].connectionAttributes.server = "https://prod-apnortheast-a.online.tableau.com";
    obj.connections[ids].connectionAttributes.siteUrlName = "fjdemosite";

    obj.connectionIds = [ids];
    return keys;
}

const archive = archiver('zip', {
  zlib: { level: 9 }
});
function ziptfl(input_tfl, output_tfl){
    console.log(`call ziptfl() -- in: ${input_tfl}, out: ${output_tfl}`);
    var zip_output = fs.createWriteStream(output_tfl);
    // pipe archive data to the file
    archive.pipe(zip_output);
    // append files from a sub-directory, putting its contents at the root of archive
    archive.directory(input_tfl, false);

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
    zip_output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
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
        console.log('Error: ', err);
        throw err;
    });
    
    // call finalize method to finalize the archive
    archive.finalize();
}

const pre_deploy_tag = "src_";
const deploy_tag = "dp_";
function copyenvs(){
    var copy_a = SVC;
    var enviroments = deploy_conf.enviroments;
    for(var i=0; i<enviroments.length; i++){
        var env = enviroments[i];
        var copy_b = path.join(DEPLOY, pre_deploy_tag+env);
        console.log(`a: ${copy_a} -> b: ${copy_b}`);
        fse.copySync(copy_a, copy_b);
        // copy_b = path.join(DEPLOY, deploy_tag+env);
        // fse.copySync(copy_a, copy_b);
    }
}

function rewrite_flow(tfl_file_name, deploy_to){
    var smp = path.join(SVC, tfl_file_name, "flow");
    var out_file = path.join(deploy_to, tfl_file_name, "flow");
    console.log(smp);
    var flow = JSON.parse(fs.readFileSync(smp, 'utf-8'));
    var nodes = Object.keys(flow.nodes);
    // console.log(nodes);

    // "connections" propatys rewrite:
    var delete_keys = conv_connections(flow);
    var connection_id = flow.connectionIds[0];

    // "nodes" propatys rewrite:
    for(var i=0; i<nodes.length; i++){
        var key = nodes[i];
        var obj = flow.nodes[key];
        console.log(`key[ ${key} ] is ${obj.baseType}`);
        // console.log(obj.baseType);
        if(obj.baseType === 'input'){
            console.log('update input');
            conv_input(obj, connection_id);
            // console.log(obj);
            // ziptfl(in,out);
        }else if(obj.baseType === 'output'){
            console.log('update output');
            conv_output(obj, connection_id);
            // console.log(obj);
        }
    }

    // console.log(flow);
    console.log(out_file);
    // fs.writeFileSync(out_file,'utf-8');
    fs.writeFileSync(out_file,JSON.stringify(flow, null, '  '));

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

function test_deploy(){
    copyenvs();
    var target_tlf = path.join('pg', 'depth', "foo.tfl");
    var pre = path.join(__dirname, 'deployment',"src_dev");
    var dep = path.join(__dirname, 'deployment',"dp_dev");
    rewrite_flow(target_tlf, pre);
    ziptfl(path.join(pre, target_tlf, '/'), path.join(dep, target_tlf));
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
    // what_params();
    test_deploy();
});

program.parse();

if (process.argv.length < 3) {
  program.help();
}
