// In a new file, e.g., middlewares/socketMiddleware.js
module.exports = (req, res, next) => {
    const io = req.app.locals.io;
    
    // Offer status update broadcast
    global.broadcastOfferStatusUpdate = (offerId, status, isListed) => {
      io.emit('offerStatusUpdate', { offerId, status, isListed });
    };
  
    // Product block status update broadcast
    global.broadcastProductBlockUpdate = (productId, isBlocked) => {
      io.emit('productBlockUpdate', { productId, isBlocked });
    };
  
    // Category list status update broadcast
    global.broadcastCategoryListUpdate = (categoryId, isListed) => {
      io.emit('categoryListUpdate', { categoryId, isListed });
    };
  
    // Variant stock update broadcast
    global.broadcastVariantStockUpdate = (productId, variantId, sizes) => {
      io.emit('variantStockUpdate', { productId, variantId, sizes });
    };
  
    next();
  };