const DEBUG = false;

const TIDDLYWIKI_PORT  = 40001;
const MOCK_SERVER_PORT = 40002;
const NUM_ATTEMPTS     = 10;

const assert       = require('assert');
const childProcess = require('child_process');
const fs           = require('fs');
const http         = require('http');
const os           = require('os');
const path         = require('path');
const process      = require('process');

const TimeoutError = new Error('timeout');

function dumpChildOutput(label, data) {
    if(!DEBUG) {
        return;
    }

    // XXX print as TAP output or something?
    let lines = data.toString().split('\n');
    for(let line of lines) {
        console.log(`${label}> ${line}`);
    }
}

const Missing = {};

function objectsMatch(got, expected) {
    for(let key of Object.keys(expected)) {
        if(expected[key] == Missing) {
            assert.ok(!got.hasOwnProperty(key));
        } else {
            assert.strictEqual(got[key], expected[key]);
        }
    }
}

async function testBasic() {
    let url = mockURL('/basic.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog',
    });

    let tiddler = await getTiddler('Blog');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog',
        url_tiddler: 'true',
    });
}

async function testOpenGraph() {
    let url = mockURL('/opengraph.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'OpenGraph Test',
    });

    let tiddler = await getTiddler('OpenGraph Test');
    objectsMatch(tiddler, {
        description: 'This is a test that opengraph meta elements work',
        location: url,
        text: `${url}\n\nThis is a test that opengraph meta elements work`,
        title: 'OpenGraph Test',
        url_tiddler: 'true',
    });
}

async function testTwitterCard() {
    let url = mockURL('/twitter-card.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Twitter Card Test',
    });

    let tiddler = await getTiddler('Twitter Card Test');
    objectsMatch(tiddler, {
        description: 'This is a test that Twitter card meta elements work',
        location: url,
        text: `${url}\n\nThis is a test that Twitter card meta elements work`,
        title: 'Twitter Card Test',
        url_tiddler: 'true',
    });
}

async function testExtraFields() {
    let url = mockURL('/basic.html');
    let [res, body] = await importURL(url, {
        tags: 'Foo Bar',
    });

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);

    let tiddler = await getTiddler(payload.title);
    objectsMatch(tiddler, {
        location: url,
        tags: 'Foo Bar',
        text: url,
        title: payload.title,
        url_tiddler: 'true',
    });
}

async function testGitHubExtractor() {
    let url = mockURL('/github.html');
    let [res, body] = await importURL(url, {
        _url: 'https://github.com/hoelzro/tiddlywiki-first-class-urls',
    });

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'tiddlywiki-first-class-urls',
    });

    let tiddler = await getTiddler(payload.title);
    objectsMatch(tiddler, {
        github_author: 'hoelzro',
        github_project: 'tiddlywiki-first-class-urls',
        location: url,
        text: `${url}\n\nAn experimental plugin to make importing tiddlers easier - hoelzro/tiddlywiki-first-class-urls`,
        title: payload.title,
        url_extractor: 'github',
        url_tiddler: 'true',
    });
}

async function test3xxRedirect() {
    let url = mockURL('/3xx.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog',
    });

    let tiddler = await getTiddler('Blog');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog',
        url_tiddler: 'true',
    });
}

async function testAlreadyHaveURLTiddler() {
    let url = mockURL('/basic.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog',
    });

    let tiddler = await getTiddler('Blog');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog',
        url_tiddler: 'true',
    });

    [res, body] = await importURL(url);
    payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 409);
}

async function testTitleAlreadyExists() {
    let url = mockURL('/basic.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog',
    });

    let tiddler = await getTiddler('Blog');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog',
        url_tiddler: 'true',
    });

    url = mockURL('/basic.html?_=testTitleAlreadyExists');
    [res, body] = await importURL(url);
    payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog 1',
    });

    tiddler = await getTiddler('Blog 1');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog 1',
        url_tiddler: 'true',
    });
}

async function testGoodreadsExtractor() {
    let url = mockURL('/goodreads.html');
    let [res, body] = await importURL(url, {
        _url: 'https://www.goodreads.com/book/show/12345.Random_Title',
    });

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Random Title',
    });

    let tiddler = await getTiddler(payload.title);
    objectsMatch(tiddler, {
        goodreads_authors: '[[Robert Hoelz]]',
        description: 'foo bar baz',
        location: url,
        title: payload.title,
        url_extractor: 'goodreads',
        url_tiddler: 'true',
        text: `${url}\n\nfoo bar baz`,
    });
}

async function testPDF() {
    let url = mockURL('/blank.pdf');
    let [res, _] = await importURL(url);

    assert.strictEqual(res.statusCode, 400);
}

async function test404() {
    let url = mockURL('/doesnt-exist/');
    let [res, _] = await importURL(url);

    assert.strictEqual(res.statusCode, 400);
}

async function testCompressedResponse() {
    let url = mockURL('/basic-compressed.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog',
    });

    let tiddler = await getTiddler('Blog');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog',
        url_tiddler: 'true',
    });
}

async function testCompressedResponseBrotli() {
    let url = mockURL('/basic-compress-brotli.html');
    let [res, body] = await importURL(url);

    let payload = JSON.parse(body);

    assert.strictEqual(res.statusCode, 201);
    objectsMatch(payload, {
        title: 'Blog',
    });

    let tiddler = await getTiddler('Blog');
    objectsMatch(tiddler, {
        location: url,
        text: url,
        title: 'Blog',
        url_tiddler: 'true',
    });
}

async function test410() {
    let url = mockURL('/410.html');
    let [res, _] = await importURL(url);

    assert.strictEqual(res.statusCode, 400);
}

let testFunctions = [
    testBasic,
    testOpenGraph,
    testTwitterCard,
    testExtraFields,
    testGitHubExtractor,
    test3xxRedirect,
    testAlreadyHaveURLTiddler,
    testTitleAlreadyExists,
    testGoodreadsExtractor,
    testPDF,
    test404,
    testCompressedResponse,
    testCompressedResponseBrotli,
    test410,
];


async function asyncMain() {
    let mockServer = await setUpMockServer();

    try {
        for(let test of testFunctions) {
            let twServer = await setUpTiddlyWikiServer();
            try {
                await test();
            } catch(e) {
                console.log('Test failed: ', e)
                console.log('--- TiddlyWiki standard output ---\n');
                console.log(Buffer.concat(twServer.stdout).toString().replace(/^/gm, '  '));
                console.log('--- TiddlyWiki standard error ---\n');
                console.log(Buffer.concat(twServer.stderr).toString().replace(/^/gm, '  '));
                throw e;
            } finally {
                await twServer.teardown();
            }
        }
    } finally {
        await mockServer.teardown();
    }
}

function TiddlyWikiServer(childProcess, wikiDir, stdout, stderr) {
    this.childProcess = childProcess;
    this.wikiDir = wikiDir;
    this.stdout = stdout;
    this.stderr = stderr;
}

TiddlyWikiServer.prototype.teardown = function() {
    let self = this;

    // XXX exit non-zero if code != 0?
    let cleanUpChildPromise = new Promise((resolve) => {
        if((self.childProcess.exitCode ?? self.childProcess.signalCode) != null) {
            resolve();
        } else {
            self.childProcess.on('exit', (code, signal) => {
                if((signal ?? '') != 'SIGTERM') {
                    console.log(`tiddlywiki exited with code ${code ?? signal}`);
                }
                resolve();
            });

            self.childProcess.kill();
        }
    });

    return cleanUpChildPromise.finally(function() {
        fs.rmSync(self.wikiDir, {
            recursive: true,
        });
    });
}

async function setUpTiddlyWikiServer() {
    let wikiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-first-class-url-tests-'));

    childProcess.spawnSync('npx', ['tiddlywiki', wikiDir, '--init', 'server']);

    let username = path.basename(wikiDir);
    let twServer = childProcess.spawn('./node_modules/.bin/tiddlywiki', ['++' + process.cwd(), wikiDir, '--listen', 'port=' + TIDDLYWIKI_PORT, 'anon-username=' + username]);

    let twServerStdout = [];
    let twServerStderr = [];

    twServer.stdout.on('data', (data) => {
        twServerStdout.push(data);
        dumpChildOutput('tw out', data);
    });

    twServer.stderr.on('data', (data) => {
        twServerStderr.push(data);
        dumpChildOutput('tw err', data);
    });
    let exitCode;
    twServer.on('exit', (code, signal) => {
        exitCode = code ?? signal;
    });

    for(let i = 0; i < NUM_ATTEMPTS; i++) {
        if(exitCode != null) {
            throw new Error(`tiddlywiki server exited with code ${exitCode}`);
        }
        try {
            let [_, body] = await request('GET', `http://localhost:${TIDDLYWIKI_PORT}/status`);
            let status = JSON.parse(body);
            if(status.username == username) {
                return new TiddlyWikiServer(twServer, wikiDir, twServerStdout, twServerStderr);
            }
        } catch(e) {
            if(e.code != 'ECONNREFUSED') {
                throw e;
            }
        }
        await sleep(1000);
    }
    throw new Error(`unable to reach tiddlywiki server after ${NUM_ATTEMPTS} attempts`);
}

function MockServer(childProcess) {
    this.childProcess = childProcess;
}

MockServer.prototype.teardown = function() {
    let self = this;

    return new Promise((resolve) => {
        if((self.childProcess.exitCode ?? self.childProcess.signalCode) != null) {
            resolve();
        } else {
            self.childProcess.on('exit', (code, signal) => {
                if((signal ?? '') != 'SIGTERM') {
                    console.log(`mock server exited with code ${code ?? signal}`);
                }
                resolve();
            });

            self.childProcess.kill();
        }
    });
};

async function setUpMockServer() {
    let mockServer = childProcess.spawn('node', ['unit-test/mock-server.js', MOCK_SERVER_PORT.toString()]);

    mockServer.stdout.on('data', (data) => {
        dumpChildOutput('mock out', data);
    });

    mockServer.stderr.on('data', (data) => {
        dumpChildOutput('mock err', data);
    });

    // XXX wait for it to be ready too

    return new MockServer(mockServer);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function request(method, url, body) {
    return new Promise((resolve, reject) => {
        let req = http.request(url, {
            method,
            timeout: 5000,
            headers: {
                'X-Requested-With': 'TiddlyWiki',
            },
        });

        req.write(body ?? '');
        req.end();

        let chunks = [];

        req.on('response', res => {
            res.on('data', data => {
                chunks.push(data);
            });

            res.on('end', () => {
                // XXX do I need to clean up resources here?
                resolve([res, Buffer.concat(chunks).toString()]);
            });

            res.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => reject(TimeoutError));
    });
}

async function importURL(urlToImport, extraFields) {
    let url = new URL(`http://localhost:${TIDDLYWIKI_PORT}/plugins/hoelzro/first-class-urls/import`);
    url.searchParams.append('url', urlToImport);
    let body;
    if(extraFields != null) {
        if('_url' in extraFields) {
            url.searchParams.append('_url', extraFields._url);
            delete extraFields._url;
        }
        body = JSON.stringify(extraFields);
    }

    return await request('PUT', url, body);
}

async function getTiddler(title) {
    let url = new URL(`http://localhost:${TIDDLYWIKI_PORT}/recipes/default/tiddlers/${title}`);
    let [_, body] = await request('GET', url);
    let t = JSON.parse(body);
    Object.assign(t, t.fields);
    delete t.fields;
    return t;
}

function mockURL(path) {
    return `http://localhost:${MOCK_SERVER_PORT}${path}`;
}

asyncMain().then(() => {
    // XXX exit conditional on test results
    process.exit(0);
}, e => {
    console.log('oh shit', e);
    process.exit(1);
});
