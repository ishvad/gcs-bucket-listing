if (typeof AUTO_TITLE != 'undefined' && AUTO_TITLE == true) {
  document.title = location.hostname;
}

if (typeof GCSBL_IGNORE_PATH == 'undefined' || GCSBL_IGNORE_PATH != true) {
  var GCSBL_IGNORE_PATH = false;
}

if (typeof BUCKET_URL == 'undefined') {
  var BUCKET_URL = location.protocol + '//' + location.hostname;
}

if (typeof BUCKET_NAME != 'undefined') {
  // if bucket_url does not start with bucket_name,
  // assume path-style url
  if (!~BUCKET_URL.indexOf(location.protocol + '//' + BUCKET_NAME)) {
    BUCKET_URL += '/' + BUCKET_NAME;
  }
}

if (typeof BUCKET_WEBSITE_URL == 'undefined') {
  var BUCKET_WEBSITE_URL = BUCKET_URL;
}

if (typeof GCSB_ROOT_DIR == 'undefined') {
  var GCSB_ROOT_DIR = '';
}

if (typeof GCSB_SORT == 'undefined') {
  var GCSB_SORT = 'DEFAULT';
}

if (typeof EXCLUDE_FILE == 'undefined') {
  var EXCLUDE_FILE = [];
} else if (typeof EXCLUDE_FILE == 'string') {
  var EXCLUDE_FILE = [EXCLUDE_FILE];
}

// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {

      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      // 1. Let O be ? ToObject(this value).
      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n â‰¥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(searchElement, elementK) is true, return true.
        if (sameValueZero(o[k], searchElement)) {
          return true;
        }
        // c. Increase k by 1.
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}

jQuery(function($) { getS3Data(); });

// This will sort your file listing by most recently modified.
// Flip the comparator to '>' if you want oldest files first.
function sortFunction(a, b) {
  switch (GCSB_SORT) {
    case "OLD2NEW":
      return a.LastModified > b.LastModified ? 1 : -1;
    case "NEW2OLD":
      return a.LastModified < b.LastModified ? 1 : -1;
    case "A2Z":
      return a.Key < b.Key ? 1 : -1;
    case "Z2A":
      return a.Key > b.Key ? 1 : -1;
    case "BIG2SMALL":
      return a.Size < b.Size ? 1 : -1;
    case "SMALL2BIG":
      return a.Size > b.Size ? 1 : -1;
  }
}

function getS3Data(marker, html) {
  var gcs_rest_url = createS3QueryUrl(marker);
  // set loading notice
  $('#listing')
      .html('<img src="https://ishvad.github.io/gcs-bucket-listing/circle.gif" />');
  $.get(gcs_rest_url)
      .done(function(data) {
        // clear loading notice
        $('#listing').html('');
        var xml = $(data);
        var info = getInfoFromS3Data(xml);

        // Slight modification by FuzzBall03
        // This will sort your file listing based on var GCSB_SORT
        // See url for example:
        // http://esp-link.s3-website-us-east-1.amazonaws.com/
        if (GCSB_SORT != 'DEFAULT') {
          var sortedFiles = info.files;
          sortedFiles.sort(sortFunction);
          info.files = sortedFiles;
        }

        buildNavigation(info);

        html = typeof html !== 'undefined' ? html + prepareTable(info) :
                                             prepareTable(info);
        if (info.nextMarker != "null") {
          getS3Data(info.nextMarker, html);
        } else {
          document.getElementById('listing').innerHTML =
              '<pre>' + html + '</pre>';
        }
      })
      .fail(function(error) {
        console.error(error);
        $('#listing').html('<strong>Error: ' + error + '</strong>');
      });
}

function buildNavigation(info) {
  var root = '<a href="/">' + location.hostname + '</a> / ';
  if (info.prefix) {
    var processedPathSegments = '';
    var content = $.map(info.prefix.split('/'), function(pathSegment) {
      processedPathSegments =
          processedPathSegments + encodeURIComponent(pathSegment) + '/';
      return '<a href="/' + processedPathSegments + '">' + pathSegment +
             '</a>';
    });
    $('#navigation').html(root + content.join(' / '));
  } else {
    $('#navigation').html(root);
  }
}

function createS3QueryUrl(marker) {
  var gcs_rest_url = BUCKET_URL;
  gcs_rest_url += '?delimiter=/';

  var rx = '.*[?&]prefix=' + GCSB_ROOT_DIR + '([^&]+)(&.*)?$';
  var prefix = '';
  if (GCSBL_IGNORE_PATH == false) {
    var prefix = location.pathname.replace(/^\//, GCSB_ROOT_DIR);
  }
  var match = location.search.match(rx);
  if (match) {
    prefix = GCSB_ROOT_DIR + match[1];
  } else {
    if (GCSBL_IGNORE_PATH) {
      var prefix = GCSB_ROOT_DIR;
    }
  }
  if (prefix) {
    // make sure we end in /
    var prefix = prefix.replace(/\/$/, '') + '/';
    gcs_rest_url += '&prefix=' + prefix;
  }
  if (marker) {
    gcs_rest_url += '&marker=' + marker;
  }
  return gcs_rest_url;
}

function getInfoFromS3Data(xml) {
  var files = $.map(xml.find('Contents'), function(item) {
    item = $(item);
    // clang-format off
    return {
      Key: item.find('Key').text(),
          LastModified: item.find('LastModified').text(),
          Size: bytesToHumanReadable(item.find('Size').text()),
          Type: 'file',
          ETag: item.find('ETag').text()
    }
    // clang-format on
  });
  var directories = $.map(xml.find('CommonPrefixes'), function(item) {
    item = $(item);
    // clang-format off
    return {
      Key: item.find('Prefix').text(),
        LastModified: '',
        ETag: '',
        Size: '-',
        Type: 'directory'
    }
    // clang-format on
  });
  if ($(xml.find('IsTruncated')[0]).text() == 'true') {
    var nextMarker = $(xml.find('NextMarker')[0]).text();
  } else {
    var nextMarker = null;
  }
  // clang-format off
  return {
    files: files,
    directories: directories,
    prefix: $(xml.find('Prefix')[0]).text(),
    nextMarker: encodeURIComponent(nextMarker)
  }
  // clang-format on
}

// info is object like:
// {
//    files: ..
//    directories: ..
//    prefix: ...
// }
function prepareTable(info) {
  var files = info.directories.concat(info.files), prefix = info.prefix;
  var cols = [45, 30, 15];
  var content = [];
  content.push(padRight('Last Modified', cols[1]) + '  ' +
               padRight('Size', cols[2]) + 'Key \n');
  content.push(new Array(cols[0] + cols[1] + cols[2] + 4).join('-') + '\n');

  // add ../ at the start of the dir listing, unless we are already at root dir
  if (prefix && prefix !== GCSB_ROOT_DIR) {
    var up = prefix.replace(/\/$/, '').split('/').slice(0, -1).concat('').join(
            '/'),  // one directory up
        item =
            {
              Key: up,
              LastModified: '',
              ETag: '',
              Size: '',
              keyText: '../',
              href: GCSBL_IGNORE_PATH ? '?prefix=' + up : '../'
            },
        row = renderRow(item, cols);
    content.push(row + '\n');
  }

  jQuery.each(files, function(idx, item) {
    // strip off the prefix
    item.keyText = item.Key.substring(prefix.length);
    if (item.Type === 'directory') {
      if (GCSBL_IGNORE_PATH) {
        item.href = location.protocol + '//' + location.hostname +
                    location.pathname + '?prefix=' + item.Key;
      } else {
        item.href = item.keyText;
      }
    } else {
//      item.href = BUCKET_WEBSITE_URL + '/' + encodeURIComponent(item.Key);
//      item.href = item.href.replace(/%2F/g, '/');
      item.href = item.keyText;
    }
    var row = renderRow(item, cols);
    if (!EXCLUDE_FILE.includes(item.Key))
      content.push(row + '\n');
  });

  return content.join('');
}

function renderRow(item, cols) {
  var row = '';
  row += padRight(item.LastModified, cols[1]) + '  ';
  row += padRight(item.Size, cols[2]);
  row += '<a href="' + item.href + '">' + item.keyText + '</a>';
  return row;
}

function padRight(padString, length) {
  var str = padString.slice(0, length - 3);
  if (padString.length > str.length) {
    str += '...';
  }
  while (str.length < length) {
    str = str + ' ';
  }
  return str;
}

function bytesToHumanReadable(sizeInBytes) {
  var i = -1;
  var units = [' kB', ' MB', ' GB'];
  do {
    sizeInBytes = sizeInBytes / 1024;
    i++;
  } while (sizeInBytes > 1024);
  return Math.max(sizeInBytes, 0.1).toFixed(1) + units[i];
}