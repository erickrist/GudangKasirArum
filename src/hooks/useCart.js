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
    if (selectedCustomer) {
      localStorage.setItem('kasir_customer', JSON.stringify(selectedCustomer));
    } else {
      localStorage.removeItem('kasir_customer');
    }
  }, [selectedCustomer]);

  // 3. Logika Tambah Barang ke Keranjang
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        // Pastikan penjumlahan qty ditangani sebagai angka
        item.productId === product.id ? { ...item, qty: Number(item.qty) + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        pcsPerCarton: product.pcsPerCarton || 1,
        price: product.price,
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
    // 1. Biarkan input kosong ('') agar pengguna bisa menghapus angka
    if (newQty === '') {
        setCart(cart.map(item =>
          item.productId === productId ? { ...item, qty: '' } : item
        ));
        return;
    }

    // 2. Ubah string menjadi Number agar mendukung desimal (0.5)
    const parsedQty = Number(newQty);

    // 3. Jika setelah diparse bukan angka yang valid (NaN) atau kurang dari 0, abaikan
    if (isNaN(parsedQty) || parsedQty < 0) return;

    // 4. Update keranjang
    setCart(cart.map(item =>
      item.productId === productId ? { ...item, qty: parsedQty } : item
    ));
  };

  const updateDiscount = (productId, discount) => {
    // Tangani input diskon kosong
    if (discount === '') {
        setCart(cart.map(item =>
            item.productId === productId ? { ...item, discount: '' } : item
        ));
        return;
    }

    const parsedDiscount = Number(discount);
    if (isNaN(parsedDiscount) || parsedDiscount < 0) return;

    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, discount: parsedDiscount }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      // Pastikan qty dan discount dibaca sebagai angka (bisa jadi string '' jika sedang diketik)
      const qty = Number(item.qty) || 0; 
      const discount = Number(item.discount) || 0;
      
      const itemSubtotal = (item.price * qty) - discount;
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