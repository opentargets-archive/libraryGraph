// wt ls
// https://wt-emepyc-gmail-com-0.run.webtask.io/kibana-auth

module.exports = function (ctx, cb) {
  var auth = ctx.secrets.kibanaAuth;
  cb(null, auth);
};
