const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

// Middleware de inject tenantId vao request
function tenantMiddleware(req, res, next) {
  if (req.user && req.user.id) {
    tenantStorage.run(req.user.id, () => {
      next();
    });
  } else {
    // Neu khong co user, van chay tiep nhung khong co tenant
    tenantStorage.run(null, () => {
      next();
    });
  }
}

// Ham helper de chay mot doan code duoi danh nghia 1 User (Dung cho Cron Job)
function runAsUser(userId, callback) {
  return tenantStorage.run(userId, callback);
}

// Mongoose Plugin de tu dong loc du lieu theo userId
function tenantPlugin(schema) {
  schema.add({ userId: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User' } });

  const setFilter = function() {
    const tenantId = tenantStorage.getStore();
    if (tenantId) {
      this.where({ userId: tenantId });
    }
  };

  schema.pre('find', setFilter);
  schema.pre('findOne', setFilter);
  schema.pre('countDocuments', setFilter);
  schema.pre('findOneAndUpdate', setFilter);
  schema.pre('updateMany', setFilter);
  schema.pre('deleteMany', setFilter);
  
  schema.pre('save', function(next) {
    const tenantId = tenantStorage.getStore();
    if (tenantId && !this.userId) {
      this.userId = tenantId;
    }
    next();
  });
}

module.exports = {
  tenantMiddleware,
  runAsUser,
  tenantPlugin
};
