# Tunnels.js - Dockerized tunneling script to use with Cloudflare and Packetriot

This script helps automate tasks of sharing local web servers to the Internet. For example, changing DNS records automatically to correspond with Packetriot's servers. The script works with the free tier on packetriot.com. This tier allows only one tunnel at a time, however one tunnel allows to share localhost ports to subdomains of a verified custom domain name. If you have multiple Packetriot accounts that both have your domain verified, you can assign them to share different servers on different computers. Thus making it possible to stop some of the local servers, while keeping others running.

# Steps

1. Read configuration and `tunnels.yml` files.
2. Check if tunnel is exists in account. If not, create it using server of choice. This might be challenging, because this requires inputting values to stdin of Packetriot CLI.
3. Setup a tunnel using "tunnels" field. First, add an http rule pointing to localhost:port. Add SSL certificate if cert is true. Next, get server IP address. Using Cloudflare API add an A record for specified subdomain to point to server's IP address. If it already points there, don't change anything. If the record exists but doesn't point to this server, overwrite it.
4. Start the tunnel.

# Complications

While, the steps are somewhat clear, the devil's in the details. During step 2, the script has to check whether the selected account already has a running tunnel. This presents a bit of a problem, since there's no public API available from Packetriot, at least, as far as I'm aware. There was hope in the provided CLI, but it actually doesn't check before creating a new tunnel, and after the fact then it says there's only one tunnel limit on ther free tier, so in turn it creates this empty tunnel with no server attached. Not ideal at all. So, this leaves us two options really:

1. Scrape the site, login into that account and parse the `Tunnels` page.
2. Somehow get that information using only HTTP requests.

The first solution, while completely functional, requires some kind of web-scraper, which by itself usually requires a whole browser installation. And all of that to make just that one request. I have some experience in dealing with those types of situations.

You see, if I somehow were to know how the login system works there, I could automate it and then send my request, parse the page and be done with it. That's absolutely marvellous, isn't it?

Login systems usually have something to do with cookies and/or persistent storage. Some combination of those. If I were to trace what requests get sent and what cookies get recieved I might be able to actually login to Packetriot's website without even having a browser or a public API! That's actually exactly how I scraped the online library of Bauman University. Anyway, let's get cookin'.

Visiting the site, two interesting cookies get my attention: `_fathom` and `SESSID`.

`_fathom` cookie:

```
{
   "isNewVisitor":false,
   "isNewSession":false,
   "pagesViewed":[
      "/",
      "/tunnels",
      "/account"
   ],
   "previousPageviewId":"omoLT4Q8epVZ4D2ibkv6",
   "lastSeen":1664208996492
}
```

`SESSID` cookie:

```
e9a923a65857db35f8e029394daaf653b40addf9f19a5d460cea923dcf70445b22304bee392c310ddaa0a6d855464e6ab4df24d26089660caf5988f16c7ccd02
```

So, as you can see the session ID cookie is just a unique identifier of this particular session. If I delete it while being logged in and then refresh the page, as expected it logs me out. When I authenticate, this cookie is basically my key, meaning I can send a request to recieve it, store it and then if I send that cookie with the request to my profile page, the server actually thinks I'm authorized. Simple stuff.

What about that `_fathom` cookie? Obviously, judging from the field names, this cookie tracks user's activity on the site, like the pages they went to and so on. Not really important to us right now.

Suppose I try to login, how would I fill out the login form without a browser? Seems impossible, right? Well, I've got an idea. Any HTML form sends a certain request on submit. In particular, for logins this is a POST request. If we just copy the body and substitute our values, we can actually send that request and probably get the right answer.

Looks like I was right. All we need to do is to send a POST request to `htpps://packetriot.com/login` with session id cookie in the header and the body should resemble something like this:

```
email=*********&password=*********&google=
```

This is just my email and password in `form-data` form. There's an empty `google` parameter there in case you were to login with Google SSO.

# Validating Configs

Validating configs is a serious task. In fact, making sure you have the right data to work with is crucial for any serious program to be good. This means working through edeg cases and whatnot. Luckily, most of that work is done for us when using Node.js or any other JS Engine. I don't mean there's strict type checking, but there are ways to check the type of a variable and if it is an instance of some object.

Now, to the problem at hand. This script uses two main configuration files in YAML format, namely: `credentials.yml` and `tunnels.yml`. `credentials.yml` stores info about Cloudflare and Packetriot identification and a domain name to create our tunnels with, which is registred in both services. For now, I'm the only user of the program, and it will probably stay that way. But, in the case I decide to make this tool public, I want to make sure users can't break configs. After all, we're talking about changing DNS records here, if something were to go wrong, it may lead to disaster. So, I've devised a small number of functions to define config file schemes (or templates), where I can provide:

1. Object structure
2. Field's variable type
3. Short description of field's purpose
4. Fallback value in case value is null (only if fallback is provided)

Now you're wondering — what the heck is a field? A field is a key inside a YAML file together with its value. YAML has three data types:

- Scalar
- List
- Dictionary

For JavaScript, all available types would be:

- number
- boolean
- string
- array
- object
- null

Once again, I've masterfully dug myself into a deep hole of my abstractions, that I can't get out of. Specifically, right now I'm at a step where I need to implement validation of config file based on a schema. And everything seemed to be lovely: just traverse the object using the schema, check the types, if any errors pop up - throw an error. But no, something had to bite me in the ass and I had to add fallback values in the case of some value being null. This complicates things. So let's go through the validation process, break it down step-by-step and figure this thing out.

Now, because the schema can be a pretty nested map, we use recursion and stop when field has no children. That's the first important thing. If it has children we go further. For example, the root field is usually either of type `array` or `object`. If it were `null`, the whole config would be essentially meaningless. Any other type means that field does not have children and therefore the config stops there. Not a very useful config is it?. So, `object` or `array` it is then.

How do we validate it? Simple, just compare the type of schema field to the object field. Complex types cannot have a fallback value, so needn't modify any fields. If the types are equal, then continue on, otherwise throw an error (`FIELD_TYPE_MISMATCH`), indicating the field name and description (good enough for now).

As for continuing on, there's a catch. To continue on the field has to have children, and if it doesn't we throw another error (`FIELD_COMPLEX_CHILDLESS`). Okay, so now we can actually go deeper. If the field is complex, has children and is of type `array`, we loop through each object and compare it to the schema field of the same depth (note that an `array` field in schema can only have ONE child field).

If field type is `object`, we access this object by all keys described in the schema. If one doesn't exist throw the `FIELD_NOT_FOUND` error. Then each of these keys becomes the object itself, and the field also advances to the corresponding position. We repeat this procedure for all keys until we reach a field with no children.

Dealing with `null` type object fields is kinda difficult, because then we have to return the new object field that was assigned the fallback value from the schema. What makes it easier is the fact that only fields of simple types (such as `number`, `boolean` and `string`) can use the fallback feature. So, if any comlpex object fields are `null`, we throw an error. By the way, if schema fields themselves are `null` the whole schema is invalid.

Let's take a closer look at the algorithm. What are the inputs? Our schema and parsed YAML config in the form of JavaScript object. What next? Essentially, we need to pass our config object through a filter. That filter checks the difference in field types between schema and object and corrects null values to fallbacks when applicable. In the end, if no errors were encountered, we should receive the modified object, with fallback values in place.

To do that, we use a recursive function. That function recieves the current schema and object fields. We first set the type of our object field. Then we determine whether that type is complex or not. The only complex types are `array` and `object`. Afterwards, check if schema and object field types are equal. If they aren't that can only mean two things:

1. The object field type is `null`. In this case we check if schema field has a fallback. If it does we overwrite the object field value with the fallback value. However, if the field is not of complex type or the fallback is not provided we throw `FIELD_NOT_FOUND` error.
2. The types don't match at all. In this case we throw `FIELD_TYPE_MISMATCH` error.

In case of type `array` the process is as follows. Check whether object field has children (the array isn't empty), and if it doesn't we throw `FIELD_COMPLEX_CHILDLESS` error. We store a temporary child schema field accessed by the `"children"` key in schema field. We then loop through the array of children. This is where recursion begins. We assign each child to the result of this function called with the temporary schema field and the child object field. Once all function calls return and we exit from the loop successfully, we continue further.

The process for type `object` is quite similar to the `array` one. This time, however, we loop through the keys in the `"children"` property of schema field. Again, the recursion kicks in. We assign to the current child object field the result of calling this same function with it and child schema field, all of them are accessed with that same loop key. Once everything is good, we go on.

Continuing on, or if the schema field is not of complex type, we simply return the object field.

I covered almost everything, except how to get the names of child and parent fields. These usually come from the schema field keys themselves. If there's no name available - usually this is the case for root (top-level) fields and specifically `object` type fields inside `array` fields. However, this should be of no importance, since the names only matter when validating children of `object` fields.

# Packetriot Servers List

1. us-west
2. us-east
3. eu-central
4. asia-southeast
5. australia
6. us-south
7. asia-south
8. africa-south
