const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");


const loadCheckOut = async (req, res) => {
  console.log("loadCheckout");
  try {
    const user = await User.findById(req.session.user);
    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
    const address = await Address.find({ userId: user._id, isDeleted: false });

    const selectedAddress = req.session.selectedAddress;
    res.render("check-out", { user, cart, address, selectedAddress });
  } catch (error) {
    console.error("Error in loadCheckOut:", error);
    res.redirect("/pageNotFound");
  }
};


const checkOut = async (req, res) => {
  console.log("Inside checkOut controller");
  try {
    const { selectedAddress } = req.body;

    if (!selectedAddress) {
      return res.status(400).send("No address selected.");
    }
    const selectedAddr = await Address.findOne({
      _id: selectedAddress,
      userId: req.session.user,
      isDeleted: false
    });

    if (!selectedAddr) {
      return res.status(400).send("Invalid address.");
    }

    const cart = await Cart.findOne({ userId: req.session.user }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    req.session.selectedAddress = selectedAddr;
    console.log("Session after setting selectedAddress:", req.session);
    res.redirect("/payment");
  } catch (error) {
    console.error("Error in checkOut controller:", error);
    res.redirect("/pageNotFound");
  }
};



const loadPlaceOrderPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const selectedAddressId = req.session.selectedAddress;

    if (!selectedAddressId) {
      return res.status(400).send("No selected address found");
    }

    const selectedAddress = await Address.findOne({
      _id: selectedAddressId,
      userId: userId,
      isDeleted: false
    });

    if (!selectedAddress) {
      return res.status(400).send("Selected address is not valid or no longer exists");
    }

    console.log(selectedAddress);
    res.render("place-order", {
      user: req.session.user,
      cart,
      selectedAddress,
    });
  } catch (error) {
    console.error("Error in loadPlaceOrderPage:", error);
    res.redirect("/pageNotFound");
  }
};

const placeOrder = async (req, res) => {
  console.log("place order");
  try {
    console.log("placeOrder inside try");
    const user = await User.findById(req.session.user);
    const { paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
    const selectedAddressId = req.session.selectedAddress;

    console.log("selected address in placeOrder", selectedAddressId);

    if (!cart || !selectedAddressId) {
      return res.status(400).send("Cart or address not found.");
    }

    const selectedAddress = await Address.findOne({
      _id: selectedAddressId,
      userId: user._id,
      isDeleted: false
    });

    if (!selectedAddress) {
      return res.status(400).send("Selected address is not valid or no longer exists");
    }

    const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    const newOrder = new Order({
      userId: user._id,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price
      })),
      address: selectedAddress._id,
      totalPrice,
      finalAmount: totalPrice,
      status: paymentMethod === "Cash on Delivery" ? "Pending" : "Processing",
      createdOn: new Date()
    });
    await newOrder.save();

    for (let item of cart.items) {
      const product = await Product.findById(item.productId._id);

      if (product) {
        if (product.quantity >= item.quantity) {
          product.quantity -= item.quantity;
          await product.save();
        } else {
          return res.status(400).send(`Not enough stock for product: ${product.productName}`);
        }
      }
    }
    await Cart.deleteOne({ userId: user._id });
    req.session.selectedAddress = null;

    res.redirect(`/order-confirmation/${newOrder._id}`);
  } catch (error) {
    console.error("Error in placeOrder controller:", error);
    res.redirect("/pageNotFound");
  }
};



const orderConfirmation = async (req, res) => {
  try {
    console.log("order-confirmation inside try");
    const orderId = req.params.orderId;  
    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("address"); 

    //console.log(order);  
    if (!order) {
      return res.status(404).send("Order not found.");
    }

    res.render("order-confirmation", { order });
  } catch (error) {
    console.error("Error in orderConfirmation controller:", error);
    res.redirect("/pageNotFound");
  }
};


const loadListOrders = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }
    const orders = await Order.find({ userId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName'
      })
      .populate('address', 'street city zip')
      .sort({ createdOn: -1 });

    //console.log("Orders found:", orders); 

    if (!orders || orders.length === 0) {
      console.log("No orders found for user:", userId);
    }
    res.render("orders", { orders });
  } catch (error) {
    console.error("Error in loadListOrders controller:", error);
    res.redirect("/pageNotFound");
  }
};


const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
     .populate("orderedItems.product")
     .populate("address");

     console.log("Order found:", order);
     res.render("order-details", { order });
}catch (error) {
  console.error("Error in loadOrderDetails controller:", error);
  res.redirect("/pageNotFound");
}
}

// const cancelOrder = async (req, res) => {
//   try {
//     console.log("Inside cancelOrder");
//     const { orderId } = req.params;

//     // Update the order status to "Cancelled"
//     const updatedOrder = await Order.findByIdAndUpdate(
//       orderId,
//       { status: 'Cancelled' },
//       { new: true } // Return the updated document
//     );

//     // Check if the order was found
//     if (!updatedOrder) {
//       return res.status(404).send('Order not found');
//     }

//     // Check if the order was already canceled
//     if (updatedOrder.status === 'Cancelled') {
//       return res.status(400).send('Order has already been canceled');
//     }

//     // Update product stock
//     for (let item of cart.items) {
//       const product = await Product.findById(item.productId._id);

//       if (product) {
//         // Reduce the product quantity based on the order quantity
//         if (product.quantity >= item.quantity) {
//           product.quantity -= item.quantity;
//           await product.save();
//         } else {
//           return res.status(400).send(`Not enough stock for product: ${product.productName}`);
//         }
//       }
//     }

//     // Send confirmation response
//     res.status(200).send('Order has been canceled successfully');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };


const cancelOrder = async (req, res) => {
  try {
    //console.log("Inside cancelOrder");
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate("orderedItems.product");
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.status === 'Cancelled') {
      return res.status(400).send('Order has already been canceled');
    }

    order.status = 'Cancelled';
    await order.save();

    for (let item of order.orderedItems) {
      const product = await Product.findById(item.product._id);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }
    res.status(200).send('Order has been canceled successfully');
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).send('Server error');
  }
};







module.exports = {
  loadCheckOut,
  checkOut,
  placeOrder,
  loadPlaceOrderPage,
  orderConfirmation,
  loadListOrders,
  loadOrderDetails,
  cancelOrder
}