# Import rule-set links format

## Structure

**remote:** `http[s]://[auth@]<host><path>?file=<rulefmt>[&key=value][#label]`  
**local:**　`file://[host]<path>?file=<rulefmt>[&key=value][#label]`  
**inline:** `inline://<base64edJsonStr>[#label]`  

## Components

### Scheme

Can be `http` or `https` or `file` or `inline`.

### Auth

Add it only if required by the target host.

### Host

The format is `hostname[:port]`.  
`hostname` can be **Domain** or **IP Address**.  
`:port` is optional, add it only if required by the target host.

### Path

The shortest format is `/`.

### Base64edJsonStr

Generation steps:

  1. Base64 encode **Headless Rule** `.rules`.
  2. Replace all `+` with `-` and all `/` with `_` in base64 string.
  3. Remove all `=` from the EOF the base64 string.

### QueryParameters

+ `file`: Available values ​​refer to **Rulefmt**.

#### Rulefmt

Can be `json` or `srs`. Rule file format.

### URIFragment

Ruleset label. Empty strings are not recommended.  
Need encoded by `encodeURIComponent`.
