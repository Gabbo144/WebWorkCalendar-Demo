var fs = require('fs');
var axios = require('axios');
var Papa = require('papaparse');


const sfdc = {
    baseurl:'',
    apiurl:'/services/data/v58.0',
    callbackUrl:'http://localhost:3000/auth',
    credentials: {},
    afterLoginUrl:undefined,

    app: {},
    server: undefined,

    logresult: function(resp) { console.log('internal--->'); console.log(JSON.stringify(resp,null,2));  },  
}

/**
 * Set token filename
 * @param {string} filename 
 */
sfdc.setTokenFile=function(filename) {
    this.tokenfile=filename;
}

/**
 * Set Custom URL
 * @param {string} customUrl 
 */
sfdc.setCustomBaseUrl=function(customUrl) {
    this.baseurl=customUrl;
}

/**
 * Set Sandbox URL
 */
sfdc.setSandboxBaseUrl=function() {
    this.baseurl='https://test.salesforce.com';
}

/**
 * Set Production URL
 */
sfdc.setProductionBaseUrl=function() {
    this.baseurl='https://login.salesforce.com';
}

/**
 * Set ClientId
 * @param {string} clientId 
 */
sfdc.setClientId=function(clientId) {
    this.clientId=clientId;
}

/**
 * Set ClientSecret
 * @param {string} clientSecret 
 */
sfdc.setClientSecret=function(clientSecret) {
    this.clientSecret=clientSecret;
}

/**
 * retrieve Token file
 * @returns null if not found, token struct if found
 */
sfdc.getSalesforceToken=async function() {
    try {
        let data=fs.readFileSync(this.tokenfile);
        this.credentials = JSON.parse(data);
        return this.credentials;
    } catch(err) {
        console.log('cannot find files');
        return false;
    }
}

/**
 * store Token file
 */
sfdc.storeSalesforceToken=async function() {
    console.log('save token');
    try {
        fs.writeFileSync(this.tokenfile, JSON.stringify(this.credentials));
        console.log('saved');
    } catch (err) {
        console.log(err);
        console.log(this.credentials);
    }
};

/**
 * init oauth2 sequence
 * listen for callback calls and store token when received
 */
sfdc.initToken=function(callback) {
    return new Promise( (resolve, reject) => {
        console.log('initToken');
        var express = require('express');
        this.app = express();
        this.server=this.app.listen(3000);
        this.app.get('/auth', async (req, res) => {
            await this.manageSalesforceCallback(req, res);
            if (this.oauth2phase==2)    this.storeSalesforceToken();
            resolve();
        });
        let loginurl=this.requestAuthCode();
        if (callback) callback(loginurl);
    })
}
/**
 * initTokenExpress
 * use this when already bind to 3000
 * @param {express app} app 
 * @returns 
 */
sfdc.initTokenExpress=function(app) {
    return new Promise( (resolve, reject) => {
      app.get('/auth', async (req, res) => {
          await sfdc.manageSalesforceCallback(req, res);
          if (this.oauth2phase==2)    sfdc.storeSalesforceToken();
          resolve();
      });
    });
  }
  
/** 
 * manage callback
 * internal function, receive express get method
 */
sfdc.manageSalesforceCallback=async function(req, res) {
    var refresh_token = req.query.refresh_token;
    var code = req.query.code;
    console.log('refresh token: ' + refresh_token);
    console.log('code: ' + code)

    if (!sfdc.afterLoginUrl)
        res.send('ok');
    else
        res.redirect(sfdc.afterLoginUrl);

    if (code != undefined) {
        this.oauth2phase=1;
        console.log('code received, get token');
        this.credentials=await this.getRefreshToken(code);
        this.storeSalesforceToken();
        if (this.server) this.server.close();
    }

    if (refresh_token) {
        this.oauth2phase=2;
        console.log('refresh_token received');
        this.credentials=refresh_token;
    }
}

/**
 * create initial url for receiving auth code
 * @returns false if errors, login url if ok
 */
sfdc.requestAuthCode=async function() {
    console.log('requestAuthCode');
    var url = this.baseurl+'/services/oauth2/authorize';
    url += '?response_type=code';
    url += '&client_id=' + encodeURIComponent(this.clientId);
    url += '&redirect_uri=' + this.callbackUrl;

    try {
        console.log(url);
        let response=await axios.get(url);

        if (response.status == 200) {
            console.log('Please authenticate via this url in the browser:');
            console.log(response.request.res.responseUrl);
            return response.request.res.responseUrl;
        } else {
            console.log('Error on authenticate:');
            console.log(response.data.url);
            console.log(response.data.explanation);
            return false;
        }
    } catch(error) {
        return false;
    }
}

/**
 * ask for new access token
 * @returns non lo so
 */
sfdc.getAccessToken=async function() {
    console.log('getAccessToken');
    var url = this.baseurl+'/services/oauth2/token';
    var body= 'grant_type=refresh_token';
    body += '&client_id=' + this.clientId;
    body += '&client_secret=' + this.clientSecret;
    body += '&refresh_token=' + this.credentials.refresh_token;

    try {
        let response=await axios.post(url, body);
        return response.data;
    } catch (error) {
        console.log('getAccessToken error:' + error.response.statusText);
        console.log('error:', error.response.data);
        return false;
    }
}

/**
 * ask for refresh token
 * @param {string} code authcode for this scope
 * @returns false if error, refresh token structure if ok
 */
sfdc.getRefreshToken=async function(code) {
    console.log('getRefreshToken');
    var url = this.baseurl+'/services/oauth2/token';
    let body = 'grant_type=authorization_code';
    body += '&code=' + code;
    body += '&client_id=' + this.clientId;
    body += '&client_secret=' + this.clientSecret;
    body += '&redirect_uri=' + this.callbackUrl;

    let opts = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }

    try {
        console.log(url);
        let response=await axios.post(url, body, opts);
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.log('getRefreshToken error:' + error.response.statusText);
        return false;
    }
}

/**
 * check autocode ttl
 * @returns true if authcode is still valid, false if not
 */
sfdc.isTokenValid=function() {

    if (!this.credentials.issued_at) {
        console.log('no credentials available');
        return false;
    }

    var h = 2;  // token live in hours
    var im = h * 60 * 60 * 1000;  // token live in milliseconds

    var i1 = parseInt(this.credentials.issued_at)
    var i2 = new Date().valueOf();

    // console.log('i2 vs i1 vs i1+im',i2,i1,i1+im);
    if (i2 > (i1 + im)) {
        console.log('authcode expired');
        return false;
    }
    console.log('authcode is still valid');
    return true;
}

/**
 * fresh authcode if old is expired
 * @returns authcode old or new
 */
sfdc.checkToken=async function() {
    console.log('checkToken');
    if (!this.isTokenValid()) {
        try {
            let res=await this.getAccessToken();

            this.credentials.issued_at = res.issued_at;
            this.credentials.access_token = res.access_token;
            this.credentials.instance_url = res.instance_url;
            console.log('new access token generated...');
            return res;
        } catch(err) {
            console.log('checkToken: error on getting a new token!');
            console.log('err',err);
            return err;
        }
    } else {
        return this.credentials;
    }
}

// ======================
// Actions
// ======================

/*

    var soql="selct id from account limit 10",
    var nextBatch=false;
    var irow=0;
    do {
        let data=await sfdc.query(soql, nextBatch);
        console.log(`${irow} of ${data.totalSize}`);

        // do what you need
        for(var a of data.records) {
            setData(a)
        }
        // do what you need

        soql=data.nextRecordsUrl;
        nextBatch=!data.done;
        irow+=data.records.length;

    } while (nextBatch);

*/

sfdc.search=async function(soql, nextRecord=false) {
    var url = soql; // next batch
    if(!nextRecord) url = this.credentials.instance_url + this.apiurl + '/search/?q=' + encodeURI(soql);
    else url = this.credentials.instance_url + soql;

    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };

    var t1=new Date();
    try {
        this.checkToken();
        let response=await axios.get(url, config);
        return response.data;
    } catch(err) {
        console.log('search error');
        console.log(err);
        console.log(err.response.data);
        return err.response.data;
    }
}

sfdc.query=async function(soql, nextRecord=false) {
    var url = soql; // next batch
    if(!nextRecord) url = this.credentials.instance_url + this.apiurl + '/query/?q=' + encodeURIComponent(soql);
    else url = this.credentials.instance_url + soql;

    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };

    var t1=new Date();
    try {
        this.checkToken();
        let response=await axios.get(url, config);
        // console.log(soql);
        // console.log('query ok');

        var t2=new Date();
        // console.log('duration (ms): '+(t2.valueOf()-t1.valueOf() ));
        // console.log('records:'+response.data.totalSize);
        return response.data;
    } catch(err) {
        console.log('query error');
        console.log(err);
        console.log(err.response.data);
        return err.response.data;
    }
}

sfdc.retrieve=async function(obj, id, fields) {
    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects/'+obj+'/'+id+'?fields='+fields.join(',');
        
    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };
    
    try {
        this.checkToken();
        let response=await axios.get(url, config);
        console.log('retrieve ok');
        return response.data;
    } catch(error) {
        console.log('retrieve bad');
        console.log(error.response.data);
        return error;
    }

}

sfdc.upsert=async function(obj, key, records) {

    if (!records || !records.length) return {};

    var body={ "allOrNone" : false, records: [] };

    records.forEach(function(r) {
        var r2=JSON.parse(JSON.stringify(r));
        r2['attributes']={ type: obj };
        body.records.push( r2 );
    });

    var url = this.credentials.instance_url;
    url += this.apiurl + '/composite/sobjects/'+obj+'/'+key;
    
    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };
    
    try {
        this.checkToken();
        let response=await axios.patch(url, body, config);
        console.log('upsert ok');
        return response.data;
    } catch(error) {
        console.log('upsert bad');
        console.log(error.response.data);
        return error;
    }

}

sfdc.create=async function(obj, record) {

    if (!record) return {};

    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects/'+obj;
    
    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };

    var body=record;

    try {
        this.checkToken();
        let response=await axios.post(url, body, config);
        console.log('create ok');
        return response.data;
    } catch(error) {
        console.log('create bad');
        console.log(error.response.data);
        return error;
    }

}

sfdc.update=async function(obj, key, record) {

    if (!record) return {};

    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects/'+obj+'/'+key;

    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };

    var body=record;

    try {
        this.checkToken();
        let response=await axios.patch(url, body, config);
        console.log('create ok');
        return response.data;
    } catch(error) {
        console.log('create bad');
        console.log(error.response.data);
        return error;
    }

}

//
// bulk api 2.0
//

sfdc.bulkQuery=async function (query) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };
    var body = {
        "operation" : "query",
        "query" : query
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/query/';

    try {
        let response=await axios.post(url, JSON.stringify(body), config)
        console.log('create ok');
        return response.data;
    } catch(error) {
        console.log('createJob bad');
        console.log(error.response.data);
        return error;
    }
};

sfdc.bulkQueryStatus=async function (jobId) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/query/' + jobId + '/';

    try {
        let response=await axios.get(url, config)
        console.log('jobStatus ok');
        return response.data;
    } catch(error) {
        console.log('jobStatus bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.bulkQueryStatusPolling=async function (jobId, waitTime, waitSteps) {

    let bulkWait={state:''};
    let count=0;
    do {
        await new Promise(resolve => setTimeout(resolve, waitTime?waitTime:1000));
        bulkWait=await sfdc.bulkQueryStatus(jobId);
        count++;
        console.log('status:',bulkWait.state,'count:', count);
    } while ( (bulkWait.state!='JobComplete' && bulkWait.state!='Failed') || (waitSteps && count<waitSteps) )

    return bulkWait.state;
}


sfdc.bulkQueryResultsLoop=async function (jobId, maxRecords) {

    let locator=undefined;
    let data=[];
    do {
        let bulkId3=await sfdc.bulkQueryResults(jobId, locator, maxRecords?maxRecords:50000);
        console.log('locator:', bulkId3.locator, bulkId3.maxRecords);
        locator=bulkId3.locator;

        let parsed=Papa.parse(bulkId3.data, {header:true, delimiter: ',', newline: "\n", skipEmptyLines: true});
        console.log(parsed.data.length);
        data=data.concat(parsed.data);
    } while (locator!='null');

    return data;
}


sfdc.bulkQueryResults=async function (jobId, locator, maxRecords) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'text/csv',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/query/' + jobId + '/results';

    let params=[];
    if (locator)  params.push('locator='+locator);
    if (maxRecords)  params.push('maxRecords='+maxRecords);
    if (params.length) {
        url += '?';
        url += params.join('&');
    }

    try {
        let response=await axios.get(url, config)
        console.log('jobStatus ok');
        let res={
            "locator": response.headers['sforce-locator'],
            "maxRecords": response.headers['sforce-numberofrecords'],
            data: response.data 
        }
        
        return res;

    } catch(error) {
        console.log('jobStatus bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.bulkCreate=async function (operation, obj, key) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };
    var body = {
        operation: operation,
        object: obj,
        contentType: "CSV",
        columnDelimiter: "COMMA",
        lineEnding: "LF",
    };
    if (key) body.externalIdFieldName=key;

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/ingest/';

    try {
        let response=await axios.post(url, JSON.stringify(body), config)
        console.log('create ok');
        return response.data;
    } catch(error) {
        console.log('createJob bad');
        console.log(error.response.data);
        return error;
    }
};

sfdc.bulkSendData=async function (jobId, data) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'text/csv',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.credentials.access_token
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,        
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/ingest/' + jobId + '/batches/';

    try {
        let response=await axios.put(url, data, config)
        console.log('sendBatch ok');
        return response.data;
    } catch(error) {
        console.log('sendBatch bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.bulkClose=async function (jobId) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };

    var body = {
        state: "UploadComplete"
    };
    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/ingest/' + jobId + '/';

    try {
        let response=await axios.patch(url, JSON.stringify(body), config)
        console.log('closeJob ok');
        return response.data;
    } catch(error) {
        console.log('closeJob bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.bulkStatus=async function (jobId) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/ingest/' + jobId + '/';

    try {
        let response=await axios.get(url, config)
        console.log('jobStatus ok');
        return response.data;
    } catch(error) {
        console.log('jobStatus bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.bulkGetResults=async function (jobId) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'text/csv',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/ingest/' + jobId + '/successfulResults';

    try {
        let response=await axios.get(url, config)
        console.log('jobStatus ok');
        return response.data;
    } catch(error) {
        console.log('jobStatus bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.bulkGetFailed=async function (jobId) {
    await this.checkToken();

    var config = {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'text/csv',
            'Authorization': 'Bearer ' + this.credentials.access_token
        }
    };

    var url = this.credentials.instance_url;
    url += this.apiurl + '/jobs/ingest/' + jobId + '/failedResults';

    try {
        let response=await axios.get(url, config)
        console.log('jobStatus ok');
        return response.data;
    } catch(error) {
        console.log('jobStatus bad');
        console.log(error.response.data);
        return error;
    }
}

sfdc.createContentVersion=async function(Title, PathOnClient, VersionData, FirstPublishLocationId) {
    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects/ContentVersion';
    
    console.log(url);

    var config = { headers: { 
        'Authorization': 'Bearer ' + this.credentials.access_token,
        // 'Content-Type': 'multipart/form-data; boundary="boundary_string" '
        'Content-Type': 'application/json'
     } };

     let body = {
        Title: Title,
        PathOnClient: PathOnClient,
        VersionData: VersionData,
        FirstPublishLocationId: FirstPublishLocationId
     }

    //       let body='--boundary_string\nContent-Disposition: form-data; name="entity_content";\nContent-Type: application/json\n';
    //  body+=JSON.stringify(record);
    //  body+='\n--boundary_string\nContent-Disposition: form-data; name="VersionData"; filename="'+record.PathOnClient+'";\nContent-Type: application/octet-stream\n';
    //  body+=data;
    //  body+='\n--boundary_string\n';


     console.log(body);

    try {
        this.checkToken();
        let response=await axios.post(url, body, config);
        console.log('createContentVersion ok');
        return response.data;
    } catch(error) {
        console.log('createContentVersion bad');
        if (error.response) console.log(error.response.data);
        else console.log(error);
        return error;
    }

}


sfdc.getContentBody=async function(bodyUrl) {

    var url = this.credentials.instance_url;
    url += bodyUrl;
    
    console.log(url);

    var config = {
        responseType: 'arraybuffer',
        headers: { 
        'Authorization': 'Bearer ' + this.credentials.access_token,
     } };

    try {
        this.checkToken();
        let response=await axios.get(url, config);
        console.log('getContentBody ok');
        return response.data;
    } catch(error) {
        console.log('getContentBody bad');
        if (error.response) console.log(error.response.data);
        else console.log(error);
        return error;
    }

}


sfdc.objectFields = async function(obj) {
    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects/'+obj+'/describe';
        
    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };
    
    try {
        this.checkToken();
        let response=await axios.get(url, config);
        console.log('objectFields ok');
        return response.data;
    } catch(error) {
        console.log('objectFields bad');
        console.log(error);
        // console.log(error.response.data);
        return error;
    }
}

sfdc.object = async function(obj) {
    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects/'+obj;
        
    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };
    
    try {
        this.checkToken();
        let response=await axios.get(url, config);
        console.log('object ok');
        return response.data;
    } catch(error) {
        console.log('object bad');
        console.log(error.response.data);
        return error;
    }

}

/**
 * List all available objects in Salesforce
 * @param {string} token - Salesforce access token
 * @returns {Promise<Array>} List of objects with their metadata
 */
sfdc.listobjects = async function(token) {
    var url = this.credentials.instance_url;
    url += this.apiurl + '/sobjects';
    
    var config = { headers: { 'Authorization': 'Bearer ' + this.credentials.access_token } };
    
    try {
        this.checkToken();
        let response=await axios.get(url, config);
        console.log('listobjects ok');
        return response.data;
    } catch(error) {
        console.log('listobjects bad');
        console.log(error.response.data);
        return error;
    }
};


// ======================
// Cache
// ======================

/**
 * Example
 * 
    var cache=sfdc.newCache(5);
    for (var i=0; i<upd.length; i++) {
        if (cache.add( upd[i] )) {
            await sfdc.upsert("Account", "Id", cache.content() );
            cache.reset();
        }
    }
    await sfdc.upsert("Account", "Id", cache.content() );
 */

sfdc.newCache=function(maxrecords=100) {
    return {
        records:[],
        maxrecords:maxrecords,

        add: function(record) {
            this.records.push(record);
            if (this.maxrecords>= this.records.length) return false;
            return true;
        },

        isEmpty: function() { return (this.records.length==0); },

        content: function() { return this.records; },

        reset: function() { this.records=[]; }

    }
}
//export default sfdc;

module.exports = sfdc;
