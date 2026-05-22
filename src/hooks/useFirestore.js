import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const useCollection = (collectionName, orderByField = null, queryLimit = null) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    let q = collection(db, collectionName);

    if (orderByField) {
      if (queryLimit) {
        q = query(q, orderBy(orderByField, 'desc'), limit(queryLimit));
      } else {
        q = query(q, orderBy(orderByField, 'desc'));
      }
    } else if (queryLimit) {
      q = query(q, limit(queryLimit));
    }

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(items);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, orderByField, queryLimit]);

  return { data, loading, error };
};

export const addDocument = async (collectionName, data) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateDocument = async (collectionName, id, data) => {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteDocument = async (collectionName, id) => {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateStockBatch = async (items) => {
  try {
    const batch = writeBatch(db);

    items.forEach(item => {
      const productRef = doc(db, 'products', item.productId);
      batch.update(productRef, {
        stockPcs: item.newStock
      });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
