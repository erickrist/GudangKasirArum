import { useState, useEffect } from 'react';

export const useCart = () => {
  // 1. Inisialisasi State dari LocalStorage
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('kasir_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });

  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    const savedCustomer = localStorage.getItem('kasir_customer');
    return savedCustomer ? JSON.parse(savedCustomer) : null;
  });

  // 2. Auto-Save ke LocalStorage jika ada perubahan
  useEffect(() => {
    localStorage.setItem('kasir_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('kasir_customer', JSON.stringify(selectedCustomer));
  }, [selectedCustomer]);

  // 3. Logika Tambah Barang ke Keranjang
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        pcsPerCarton: product.pcsPerCarton || 1,
        price: product.price,
        // INI BAGIAN PALING PENTING: Merekam HPP (Harga Modal) saat barang diklik
        capitalPrice: product.hpp || 0, 
        qty: 1,
        discount: 0,
        stockPcs: product.stockPcs,
      }]);
    }

    // Auto-scroll ke item yang baru diklik
    setTimeout(() => {
      const element = document.getElementById(`cart-item-${product.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const updateQty = (productId, newQty) => {
    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.productId === productId ? { ...item, qty: newQty } : item
    ));
  };

  const updateDiscount = (productId, discount) => {
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, discount: Math.max(0, discount) }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemSubtotal = (item.price * item.qty) - (item.discount || 0);
      return sum + itemSubtotal;
    }, 0);
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    localStorage.removeItem('kasir_cart');
    localStorage.removeItem('kasir_customer');
  };

  // 4. Return semua state dan fungsi agar bisa dipakai di Kasir.jsx
  return {
    cart,
    selectedCustomer,
    setSelectedCustomer,
    addToCart,
    updateQty,
    updateDiscount,
    removeFromCart,
    calculateSubtotal,
    clearCart
  };
};