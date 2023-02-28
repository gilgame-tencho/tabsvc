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

const WS = path.join(__dirname, ws_name);
const ROOT = path.basename(__dirname);
const SVC = path.join(__dirname, svc_name);
const DEPLOY = path.join(__dirname, "deployment");

const target = JSON.parse(fs.readFileSync(path.join(__dirname, target_name)));
const deploy_conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'conf', "deploy.json")));
// const csv = fs.readFileSync(path.join(__dirname, 'conf', 'tabsvc_param.csv'));

const tableau_server_tag = "LBT_";
const deploy_env = "om1";

function obj_copy(obj){
    return Object.assign({}, JSON.parse(JSON.stringify(obj)));
}

function local_to_siteproject(hyperFilePath){
    var param = {};

    var hyper_path = hyperFilePath.split("\\");
    var hyper_file_name = hyper_path[hyper_path.length-1];
    var name = hyper_file_name.replace('.hyper','');
    var project = hyper_path[hyper_path.length - 2];

    param.name = name;
    param.project = project;
    // param.dbname = "";
    console.log(`[debug] local_to_siteproject: ${hyperFilePath} ->`);
    console.log(param);
    return param;
}

const input_con = target.nodes.any_if1.convert;
function conv_input(node, connection_param, flow){
    const conv = obj_copy(input_con);
    const conp = obj_copy(connection_param);

    if(conp.old_connections[node.connectionId].connectionAttributes.class != "hyper"){
        console.log(`connection is : class [${conp.old_connections[node.connectionId].connectionAttributes.class}]`);
        return
    }

    // ## IF connection is 'hyper'
    var hyperFileName = conp.old_connections[node.connectionId].connectionAttributes.dbname;
    var site_param = local_to_siteproject(hyperFileName);
    var hyperName = conp.old_connections[node.connectionId].name.replace('.hyper','');
    console.log(`   hyperName: ${hyperName}`);
    var dbname = deploy_conf.enviroments[deploy_env].hyper[hyperName] + "";

    // console.log(input_con);

    node.nodeType = conv.nodeType;

    // ## [Update] connectionAttributes
    node.connectionAttributes = conv.connectionAttributes;
    node.connectionAttributes.dbname = dbname;

    node.projectName = site_param.project;
    node.connectionAttributes.datasourceName = site_param.name;

    node.relation.table = conv.relation.table;
    node.connectionId = conp.connection_id;

    return node;
}

const output_con = target.nodes.any_if2.convert;
function conv_output(node, connection_param){
    var conv = obj_copy(output_con);
    var conp = connection_param;
    var site_param = local_to_siteproject(node.hyperOutputFile);

    node.nodeType = conv.nodeType;
    node.projectName = site_param.project;
    // node.projectLuid = "447b9453-3507-4cd3-b936-25258f9ac360";
    node.projectLuid = deploy_conf.enviroments[deploy_env].project[node.projectName];
    node.datasourceName = site_param.name;
    node.datasourceDescription = conv.datasourceDescription;
    // node.serverUrl = "https://prod-apnortheast-a.online.tableau.com/#/site/fjdemosite";
    node.serverUrl = deploy_conf.enviroments[deploy_env].connections["TableauServer"].serverUrl;

    delete node.hyperOutputFile;
    delete node.tdsOutput;
}

const connection_con = target.connections;
function conv_connections(obj){
    const conv = obj_copy(connection_con);
    var old_connections = obj_copy(obj.connections);
    var keys = Object.keys(obj.connections);
    var delete_keys = [];
    var connection_tableauServer = null;
    for(var i=0; i<keys.length; i++){
        var key = keys[i];
        var con = obj.connections[key];
        // console.log(con.connectionAttributes);
        if(con.connectionAttributes.class === "hyper"){
            // console.log("go");
            if(connection_tableauServer === null){
                connection_tableauServer = key;
            }else{
                delete_keys.push(key);
                delete obj.connections[key];
            }
        }else if(con.connectionAttributes.class === "postgres"){
            // con = obj_copy(conv.postgres);
            con.name = "vcdb";
            con.connectionAttributes.server = deploy_conf.enviroments[deploy_env].connections.VC.name;
        }else{
            // console.log("no");
        }
    }
    if(connection_tableauServer !== null){
        obj.connections[connection_tableauServer] = conv.TableauServer;
        obj.connections[connection_tableauServer].id = connection_tableauServer;
        obj.connections[connection_tableauServer].name = deploy_conf.enviroments[deploy_env].connections.TableauServer.name;
        obj.connections[connection_tableauServer].connectionAttributes.server = deploy_conf.enviroments[deploy_env].connections.TableauServer.connectionAttributes.server;
        obj.connections[connection_tableauServer].connectionAttributes.siteUrlName = deploy_conf.enviroments[deploy_env].connections.TableauServer.connectionAttributes.siteUrlName;
    }
    obj.connectionIds = Object.keys(obj.connections);
    return [connection_tableauServer, old_connections, delete_keys];
    // #--> return [old_connections, delete_keys]
}

class tabsvc_master{
    constructor(){
        this.zip_queue = [];
        this.deploy_archives = [deploy_env];
        this.zip_done = false;
        this.next_task = {};
        this.wait = true;
        this.no_work = false;

        this.intervalID = setInterval(() => {
            console.log("[tab zipper] Let's do our best today!");
            console.log(`  zip_queue.length: ${this.zip_queue.length}, deploy_archives: ${this.deploy_archives.length}, No work: ${this.no_work}`)
            // console.log(this.zip_queue);
            if(this.no_work){
                console.log("Today's holiday.");
                setTimeout(()=>{
                    clearInterval(this.intervalID)
                })
            }
            if(this.zip_done && this.deploy_archives.length == 0){
                console.log("Make archive All Done!!");
                setTimeout(()=>{
                    clearInterval(this.intervalID)
                })
            }
            if(this.zip_queue.length == 0) {
                console.log("Make tfl All Done!!");
                this.zip_done = true;
            }
            if(this.zip_queue.length > 0){
                this.next_task = this.zip_queue.shift();
                this.ziptfl();
                this.wait = false;
            }
            /// ##########################
            if(this.wait){
                return 0;
            }
            if(this.zip_done && this.deploy_archives.length > 0){
                // this.next_task = this.deploy_archives.shift();
                var ts = new Date();

                this.deploy_archives.shift();
                this.next_task = {};
                this.next_task.input_tfl = path.join(__dirname, 'deployment',"dp_" + deploy_env);
                this.next_task.output_tfl = path.join(__dirname, "deployment", `dp_${deploy_env}_${ts.getTime()}.zip`);

                this.ziptfl();
            }
        }, 500);
        // this.zipper = function(){
        // this.intervalID = setInterval(this.zipper, 500);
    }

    ziptfl(){
        var archive = archiver('zip', {
            zlib: { level: 9 }
        });
        var input_tfl = this.next_task.input_tfl;
        var output_tfl = this.next_task.output_tfl;
        console.log(`  [zip start] call ziptfl(): ${output_tfl}`);
        // var zip_output = fs.createWriteStream(output_tfl);
        let zip_output = fs.createWriteStream(output_tfl);
        // pipe archive data to the file
        archive.pipe(zip_output);
        // append files from a sub-directory, putting its contents at the root of archive
        archive.directory(input_tfl, false);

        // finalize the archive (ie we are done appending files but streams have to finish yet)
        // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
        zip_output.on('close', function() {
            // console.log('  [zip close] archiver has been finalized and the output file descriptor has closed.');
            console.log(`  [zip close] call ziptfl(): ${output_tfl}`);
        });

        // good practice to catch this error explicitly
        archive.on('error', function(err) {
            console.log('  [zip Error!]: ', err);
            // throw err;
            console.log('  [zip ERR] Missing zip file: ', output_tfl);
            return;
        });

        // call finalize method to finalize the archive
        archive.finalize();
    }
}

const TAB_MS = new tabsvc_master();

const pre_deploy_tag = "src_";
const deploy_tag = "dp_";
function copyenvs(){
    // var copy_a = SVC;
    var enviroments = Object.keys(deploy_conf.enviroments);
    for(var i=0; i<enviroments.length; i++){
        var env = enviroments[i];
        var copy_b = path.join(DEPLOY, pre_deploy_tag+env);
        console.log(`a: ${SVC} -> b: ${copy_b}`);
        fse.copySync(SVC, copy_b);
        // copy_b = path.join(DEPLOY, deploy_tag+env);
        // fse.copySync(SVC, copy_b);
        copy_b = path.join(DEPLOY, deploy_tag+env);
        // if (!fs.existsSync(dir)) {
        //     fs.mkdirSync(dir);
        // }
        fse.copySync(WS, copy_b);
    }
}

function rewrite_flow(tfl_file_name, deploy_to){
    var smp = path.join(SVC, tfl_file_name, "flow");
    var out_file = path.join(deploy_to, tfl_file_name, "flow");
    console.log(smp);
    var flow = JSON.parse(fs.readFileSync(smp, 'utf-8'));
    var nodes = Object.keys(flow.nodes);

    // "connections" propatys rewrite:
    const [connection_id, old_connections, delete_keys] = conv_connections(flow);
    // var connection_id = flow.connectionIds[0];
    const connection_param = {
        "connection_id" : connection_id,
        "old_connections" : old_connections,
        "delete_keys" : delete_keys,
        "connections" : flow.connections
    }
    // console.log(connection_param);
    // console.log(nodes);

    // "nodes" propatys rewrite:
    for(var i=0; i<nodes.length; i++){
        var key = nodes[i];
        var node = flow.nodes[key];

        if(node.baseType === 'input'){
            console.log(`[debug] update input: ${node.name}`);
            node = conv_input(node, connection_param, flow);

        }else if(node.baseType === 'output'){
            console.log(`[debug] update output: ${node.name}`);
            conv_output(node, connection_param);
        }else{
            // console.log("  none.");
        }

    }

    console.log(out_file);
    fs.writeFileSync(out_file,JSON.stringify(flow, null, '  '));
}

function what_params(){
    console.log(WS);
    console.log(ROOT);
    console.log(option);
    var ts = new Date();
    console.log(ts.getTime());

}

function path_parse(_path){
    var res = {};
    res.path = _path;
    res.order = _path.split('\\');
    res.root_index = res.order.findIndex(element => element === ROOT) + 2;
    res.ws_order = res.order.concat().slice(res.root_index, res.order.length - 1);

    var tmp_order = res.order.concat();
    tmp_order.splice(res.root_index - 1, 1, svc_name);
    res.svc_path = tmp_order.join('\\');

    tmp_order = res.order.concat();
    tmp_order.splice(res.root_index - 1, 1, path.join('deployment',`src_${deploy_env}`));
    res.src_dev = tmp_order.join('\\');

    res.name = res.order[res.order.length -1];
    res.base_name = res.name.replace('.'+option.ext, '');
    res.root = res.order[0];
    return res;
}

function test_deploy(){
    // console.log(csv);
}

function all_deploy(){
    var envs = deploy_conf.enviroments;
    // var keys = Object.keys(envs);
    var keys = [deploy_env];

    if(false){
        copyenvs();
    }

    fl.read([WS], option, function(rs){
        for(var i=0; i<rs.length; i++){
            var file = rs[i];
            console.log(file);
            var item = path_parse(file.path);
            // console.log(item);

            var wdir = path.join('deployment',`src_${deploy_env}`);
            for(var j=0; j<item.ws_order.length; j++){
                wdir = path.join(wdir, item.ws_order[j]);
                if (!fs.existsSync(wdir)) {
                    fs.mkdirSync(wdir);
                }
            }
            var target_tlf = path.join(item.ws_order.join('/'), item.name);

            for(var j=0; j<keys.length; j++){
                var key = keys[j];
                var env = envs[key];
                var pre = path.join(__dirname, 'deployment',"src_" + key);
                var dep = path.join(__dirname, 'deployment',"dp_" + key);

                var param = {};
                param.target_tlf = target_tlf;
                param.pre = pre;
                param.dep = dep;
                param.env = env;
                param.archive_name = `dp_${key}.zip`;
                svc_deploy(param);
            }
        }
    });
}

function svc_deploy(param){
    try {
        rewrite_flow(param.target_tlf, param.pre);
        TAB_MS.zip_queue.push(
            {
                "input_tfl" : path.join(param.pre, param.target_tlf, '/'),
                "output_tfl" : path.join(param.dep, param.target_tlf)
            }
        );
    }
    catch(e){
        console.log("catch err.", e);
    }
}

function zipper_no_work(){
    TAB_MS.no_work = true;
}

//###############################
//####  command main
//###############################
{
    function main_init(){
        zipper_no_work();
        console.log('init function is comming soon!!');
        copyenvs();
    }

    function main_decompose(){
        zipper_no_work();

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
                exec('unzip -o "' + item.path + '" -d ' + item.svc_path, (err, stdout, stderr) => {
                    if (err) { throw err }
                    console.log(`stdout: ${stdout}`);
                });
            }
        });
    }

    function main_status(){
        zipper_no_work();
        console.log(SVC);
        exec('cd ' + __dirname);
        exec('bash bin/git_status.sh', (err, stdout, stderr) => {
            if (err) { throw err }
            console.log(`${stdout}`);
        });
    }

    function main_commit(){
        zipper_no_work();
        console.log(SVC);
        exec('cd ' + __dirname);
        exec('bash bin/git_commit.sh', (err, stdout, stderr) => {
            if (err) { console.log(stderr); throw err }
            console.log(`${stdout}`);
        });
    }

    function main_deploy(){
        // console.log('comming soon. deploy!!');
        all_deploy();
    }

    function main_clean(){
        zipper_no_work();
        // rm deployment -rf
        console.log('comming soon. clean.');
    }
}

//###############################
//####  program commands
//###############################
{
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
    .alias('dec')
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
    .alias('dep')
    .action((str, options)=> {
        main_deploy();
    });

    program.command('clean')
    .description("clean 'deployment'")
    .action((str, options)=> {
        main_clean();
    });

    program.command('dev')
    .description('show dev parameters')
    .action((str, options)=> {
        what_params();
        // test_deploy();
    });

    program.parse();

    if (process.argv.length < 3) {
    program.help();
    }
}