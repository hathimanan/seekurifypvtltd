import  bcrypt from 'bcryptjs';
const hash = "54e26837fc32297468f5654e89fa69cd:78b2736edba0ad3ce6676657b8c77fb90b16a50ca5c530a74648c00f40bf7cc9"; // from MongoDB
bcrypt.compare("lvk%wb1&LP$O6Uca", hash).then(console.log); // should return true
const hash2 = "54e26837fc32297468f5654e89fa69cd:78b2736edba0ad3ce6676657b8c77fb90b16a50ca5c530a74648c00f40bf7cc9";
bcrypt.compare("$2y$10$0f/90783mwQEA0RO2Ixl/.TcSqABuF61EZ9zw.wVa9N6ips1s4JRa", hash2).then(console.log); // should return true

const hash3 = "614ab6ca9a34120730f9241cc1189cee:6d6d32acfb1ada10e195538159ec69747d04f5cd97ef5d26724454cb2c7cc3b5";
bcrypt.compare("OAwe%R96rlsOFdvd", hash3).then(console.log);

