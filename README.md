Create nice directory listings for Google Cloud Storage buckets using only javascript and HTML; adapted from rufuspollock/s3-bucket-listing.

## Usage

### 1. Create GCS bucket, and set appropriate object permissions and CORS policy

Once the bucket's been created, under permissions add "allUsers" as a member, with the roles "Storage Object Viewer" and "Storage Bucket Reader" - this ensures objects in the bucket are both viewable and listable.

If using a custom domain, configure the CORS policy to allow access from your domain, e.g.:

`gsutil cors set cors-json-file.json gs://my-bucket-name`

where `cors-json-file.json` contains something like the following:

```json
[
    {
      "origin": ["http://my-custom-domain.com"],
      "responseHeader": ["Content-Type"],
      "method": ["GET", "HEAD", "DELETE"],
      "maxAgeSeconds": 3600
    }
]
```
(https://cloud.google.com/storage/docs/configuring-cors#configure-cors-bucket)

### 2. Set bucket to serve needed files

Ensure the bucket is set to serve `index.html` as both the index page, and the 404 page.

Edit `index.html` to your needs, and upload it to the bucket's root.

(Optional) You may want to serve `list.js` and `circle.gif` from GCS instead of from this repo - if needed just upload the files to root and edit the paths in `index.html` and `list.js`.

### 3. Start serving!

Things to note:
- if using a custom domain, you'll need to add a CNAME record pointing to `c.storage.googleapis.com` on whatever domain/subdomain you to serve.

## How it works

The script downloads your XML bucket listing, parses it and simulates a webserver's text-based directory browsing mode.


#### `BUCKET_URL` variable

Valid options = 

`'https://storage.googleapis.com/[BUCKET_NAME]'` (http or https; default) or 

`'http://[BUCKET_NAME].storage.googleapis.com'` (will not work with https!)

- Do __NOT__ put a trailing '/', e.g. `https://storage.googleapis.com/[BUCKET_NAME]/`

This variable tells the script where your bucket XML listing is, and where the files are.


#### `GCSB_ROOT_DIR` variable

Valid options = `''` (default) or `'SUBDIR_L1/'` or `'SUBDIR_L1/SUBDIR_L2/'` or etc.

- Do __NOT__ put a leading '/',     e.g. `'/SUBDIR_L1/'`
- Do __NOT__ omit the trailing '/', e.g. `'SUBDIR_L1'`

This will disallow navigation shallower than your set directory.

Note that this only disallows navigation to shallower directories, but __NOT__ access. Any person with knowledge of the existence of bucket XML listings will be able to manually access those files.


### `GCSB_SORT` variable

This will sort your bucket listing. Variable options should be self-explanatory.

Valid options:

- `OLD2NEW`
- `NEW2OLD`
- `A2Z`
- `Z2A`
- `BIG2SMALL`
- `SMALL2BIG`


### `EXCLUDE_FILE` variable

This variable is optional.  It allows you to exclude a file (e.g. index.html) or a list of files from the file listings.


### `AUTO_TITLE` variable

This variable is optional.  It allows you to automatically set the title.

### `GCSBL_IGNORE_PATH` variable

Valid options = `false` (default) or `true`

Setting this to false will cause URL navigation to be in this form:
- _`https://storage.googleapis.com/[BUCKET_NAME]/subfolder/`_

You will have to put the html code in your page html AND your error 404 document.

Setting this to true will cause URL navigation to be in this form:
- _`https://storage.googleapis.com/[BUCKET_NAME]/?prefix=subfolder/`_
