import { 
    collection, 
    getDocs, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy,
    writeBatch,
    setDoc,
    getDoc,
    serverTimestamp,
    onSnapshot,
    limit,
    startAfter,
    where,
    getAggregateFromServer,
    count,
    sum
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Sample products catalog for seeding and mock fallback
const defaultProducts = [
    {
        name: 'Gym Bro Hoodie',
        price: 4949,
        category: 'hoodies',
        description: 'Premium heavyweight gym hoodie with a soft inner fleece.',
        image: "images/gym-bro-hoodie.webp",
        stock: 50
    },
    {
        name: 'Sleeveless Tank Tee',
        price: 2474,
        category: 'oversized',
        description: 'Breathable performance tank tee for intense workouts.',
        image: "images/oversized-gym-tshirt.webp",
        stock: 40
    },
    {
        name: 'Siren Crop Tee',
        price: 2199,
        category: 'oversized',
        description: 'Cropped street-gym tee with a flattering fit.',
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=400",
        stock: 35
    },
    {
        name: 'Beast Track Pants',
        price: 3849,
        category: 'trackpants',
        description: 'Flexible track pants built for movement and comfort.',
        image: "images/track-pants.jpg",
        stock: 60
    },
    {
        name: 'Pro Lift Gloves',
        price: 1649,
        category: 'accessories',
        description: 'Grip-enhancing training gloves for heavy sets.',
        image: "images/pro-lift-gloves.jpg",
        stock: 70
    },
    {
        name: 'Warrior Leggings',
        price: 4124,
        category: 'trackpants',
        description: 'High-stretch leggings for strength, cardio, and recovery.',
        image: "images/warrior-leggings.webp",
        stock: 45
    },
    {
        name: 'Lifting Straps',
        price: 1099,
        category: 'accessories',
        description: 'Support straps to help you lock in form and reps.',
        image: "images/lifting-straps.jpg",
        stock: 80
    },
    {
        name: 'Deadlift Belt',
        price: 2749,
        category: 'accessories',
        description: 'Stable support belt for safer and stronger deadlifts.',
        image: "images/deadlift-belt.jpg",
        stock: 25
    }
];

// Helper to check if mock mode is on
function isMock() {
    return window.useFirebaseMock === true;
}

// ----------------------------------------------------
// 1. PRODUCTS DB METHODS
// ----------------------------------------------------
async function dbGetProducts() {
    if (isMock()) {
        console.log("Mock DB: Fetching products catalog locally.");
        let localProducts = localStorage.getItem('gymbroMockProducts');
        let products;
        if (!localProducts) {
            products = defaultProducts.map(p => ({
                ...p,
                id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            }));
            localStorage.setItem('gymbroMockProducts', JSON.stringify(products));
        } else {
            products = JSON.parse(localProducts);
            let updated = false;
            products = products.map(p => {
                const pid = p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (p.id !== pid) {
                    p.id = pid;
                    updated = true;
                }
                return p;
            });
            if (updated) {
                localStorage.setItem('gymbroMockProducts', JSON.stringify(products));
            }
        }
        return { ok: true, products: products };
    }

    try {
        const db = window.firebaseDb;
        const productsCol = collection(db, 'products');
        const querySnapshot = await getDocs(productsCol);
        let list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });

        // Seed automatically on first run if empty
        if (list.length === 0) {
            console.log("Firestore empty. Seeding catalog...");
            await dbSeedProducts();
            return dbGetProducts();
        }

        return { ok: true, products: list };
    } catch (err) {
        console.error("Firestore dbGetProducts error:", err);
        throw err;
    }
}

async function dbSeedProducts() {
    if (isMock()) {
        const products = defaultProducts.map(p => ({
            ...p,
            id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        }));
        localStorage.setItem('gymbroMockProducts', JSON.stringify(products));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const productsCol = collection(db, 'products');
        const batch = writeBatch(db);

        for (const p of defaultProducts) {
            // Use custom document ID based on product name to prevent double entry
            const docId = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const docRef = doc(productsCol, docId);
            batch.set(docRef, p);
        }

        await batch.commit();
        console.log("Firestore catalog successfully seeded.");
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbSeedProducts error:", err);
        throw err;
    }
}

async function dbAddProduct(productData) {
    if (isMock()) {
        let localProducts = JSON.parse(localStorage.getItem('gymbroMockProducts') || '[]');
        // If an id is explicitly provided (editing), update in place; otherwise generate a new unique id
        let docId;
        if (productData.id) {
            // Edit mode: keep the existing id
            docId = productData.id;
        } else {
            const baseSlug = productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            // Ensure uniqueness in mock: add a short random suffix if slug already exists
            const existingSlugs = new Set(localProducts.map(p => p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')));
            if (existingSlugs.has(baseSlug)) {
                docId = baseSlug + '-' + Math.random().toString(36).substr(2, 6);
            } else {
                docId = baseSlug;
            }
        }
        const newProduct = { ...productData, id: docId };

        const existingIdx = localProducts.findIndex(p => {
            const pid = p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return pid === docId;
        });

        if (existingIdx > -1) {
            localProducts[existingIdx] = newProduct;
        } else {
            localProducts.push(newProduct);
        }
        localStorage.setItem('gymbroMockProducts', JSON.stringify(localProducts));
        return { ok: true, id: docId };
    }

    try {
        const db = window.firebaseDb;
        const productsCol = collection(db, 'products');

        let docId;
        if (productData.id) {
            // Edit mode: reuse the existing document id
            docId = productData.id;
        } else {
            // New product: create a unique slug + random suffix to avoid overwrites
            const baseSlug = productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
            const suffix = Math.random().toString(36).substr(2, 6);
            docId = `${baseSlug}-${suffix}`;
        }

        // Strip the `id` field from the document data written to Firestore
        const { id: _id, ...dataToWrite } = productData;
        const docRef = doc(productsCol, docId);
        await setDoc(docRef, dataToWrite);
        console.log("Product saved:", productData.name, "with id:", docId);
        return { ok: true, id: docId };
    } catch (err) {
        console.error("Firestore dbAddProduct error:", err);
        throw err;
    }
}

async function dbDeleteProduct(productId) {
    if (isMock()) {
        let localProducts = JSON.parse(localStorage.getItem('gymbroMockProducts') || '[]');
        localProducts = localProducts.filter(p => {
            const pid = p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return pid !== productId;
        });
        localStorage.setItem('gymbroMockProducts', JSON.stringify(localProducts));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'products', productId);
        await deleteDoc(docRef);
        console.log("Product deleted:", productId);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbDeleteProduct error:", err);
        throw err;
    }
}

// ----------------------------------------------------
// 2. ORDERS DB METHODS
// ----------------------------------------------------
async function dbAddOrder(orderData) {
    if (isMock()) {
        console.log("Mock DB: Placing order locally.");
        let orders = JSON.parse(localStorage.getItem('gymbroMockOrders') || '[]');
        const newOrder = {
            id: 'MOCK-ORD-' + Date.now(),
            status: 'pending',
            ...orderData,
            createdAt: new Date().toISOString()
        };
        orders.unshift(newOrder); // Add to beginning
        localStorage.setItem('gymbroMockOrders', JSON.stringify(orders));
        return { ok: true, order: newOrder };
    }

    try {
        const db = window.firebaseDb;
        const ordersCol = collection(db, 'orders');
        const orderDoc = {
            status: 'pending',
            ...orderData,
            createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(ordersCol, orderDoc);
        return { ok: true, order: { _id: docRef.id, ...orderDoc } };
    } catch (err) {
        console.error("Firestore dbAddOrder error:", err);
        throw err;
    }
}

async function dbGetOrders(options = {}) {
    const { pageSize = 50, startAfterDoc = null, searchQ = '', dateFrom = null, dateTo = null, noLimit = false } = options;

    if (isMock()) {
        console.log("Mock DB: Fetching orders locally with pagination.");
        let list = JSON.parse(localStorage.getItem('gymbroMockOrders') || '[]');
        
        // Filter search
        if (searchQ) {
            const sq = searchQ.toLowerCase().trim();
            list = list.filter(o => 
                (o.id || '').toLowerCase().includes(sq) || 
                (o.customer || '').toLowerCase().includes(sq) || 
                (o.customerMobile || '').toLowerCase().includes(sq) ||
                (o.customerEmail || '').toLowerCase().includes(sq)
            );
        }
        
        // Filter date
        if (dateFrom || dateTo) {
            const from = dateFrom ? new Date(dateFrom) : null;
            const to = dateTo ? new Date(dateTo) : null;
            list = list.filter(o => {
                const oDate = o.date ? new Date(o.date) : null;
                if (!oDate || isNaN(oDate)) return false;
                if (from && oDate < from) return false;
                if (to && oDate > to) return false;
                return true;
            });
        }
        
        // Sort by createdAt desc
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        let pageItems = list;
        let lastDoc = null;
        if (!noLimit) {
            let startIndex = 0;
            if (startAfterDoc) {
                const idx = list.findIndex(o => o.id === startAfterDoc || o._id === startAfterDoc);
                if (idx !== -1) {
                    startIndex = idx + 1;
                }
            }
            pageItems = list.slice(startIndex, startIndex + pageSize);
            lastDoc = pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
        }
        
        return { ok: true, orders: pageItems, lastDoc };
    }

    try {
        const db = window.firebaseDb;
        const ordersCol = collection(db, 'orders');
        let constraints = [];
        const cleanSearch = searchQ.trim();
        let directOrder = null;

        // 1. Direct lookup if search is a potential Document ID
        if (cleanSearch && (cleanSearch.length >= 15 || cleanSearch.startsWith('MOCK-'))) {
            try {
                const docRef = doc(db, 'orders', cleanSearch);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    directOrder = { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
                }
            } catch (e) {
                console.error("Direct order getDoc failed:", e);
            }
            if (directOrder) {
                return { ok: true, orders: [directOrder], lastDoc: null };
            }
        }

        // 2. Build filter and order constraints
        if (cleanSearch) {
            if (/^\d+$/.test(cleanSearch)) {
                constraints.push(where('customerMobile', '>=', cleanSearch));
                constraints.push(where('customerMobile', '<=', cleanSearch + '\uf8ff'));
                constraints.push(orderBy('customerMobile'));
            } else if (cleanSearch.includes('@')) {
                const emailLower = cleanSearch.toLowerCase();
                constraints.push(where('customerEmail', '>=', emailLower));
                constraints.push(where('customerEmail', '<=', emailLower + '\uf8ff'));
                constraints.push(orderBy('customerEmail'));
            } else {
                constraints.push(where('customer', '>=', cleanSearch));
                constraints.push(where('customer', '<=', cleanSearch + '\uf8ff'));
                constraints.push(orderBy('customer'));
            }
        } else if (dateFrom || dateTo) {
            if (dateFrom) {
                constraints.push(where('createdAt', '>=', dateFrom.toISOString()));
            }
            if (dateTo) {
                constraints.push(where('createdAt', '<=', dateTo.toISOString()));
            }
            constraints.push(orderBy('createdAt', 'desc'));
        } else {
            constraints.push(orderBy('createdAt', 'desc'));
        }

        // Apply startAfter cursor
        if (startAfterDoc && !noLimit) {
            constraints.push(startAfter(startAfterDoc));
        }

        // Apply page limit
        if (!noLimit) {
            constraints.push(limit(pageSize));
        }

        const q = query(ordersCol, ...constraints);
        const querySnapshot = await getDocs(q);
        let list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, _id: doc.id, ...doc.data() });
        });

        const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
        return { ok: true, orders: list, lastDoc };
    } catch (err) {
        console.error("Firestore dbGetOrders error:", err);
        throw err;
    }
}

async function dbGetOrdersCount(options = {}) {
    const { searchQ = '', dateFrom = null, dateTo = null } = options;

    if (isMock()) {
        let list = JSON.parse(localStorage.getItem('gymbroMockOrders') || '[]');
        if (searchQ) {
            const sq = searchQ.toLowerCase().trim();
            list = list.filter(o => 
                (o.id || '').toLowerCase().includes(sq) || 
                (o.customer || '').toLowerCase().includes(sq) || 
                (o.customerMobile || '').toLowerCase().includes(sq) ||
                (o.customerEmail || '').toLowerCase().includes(sq)
            );
        }
        if (dateFrom || dateTo) {
            const from = dateFrom ? new Date(dateFrom) : null;
            const to = dateTo ? new Date(dateTo) : null;
            list = list.filter(o => {
                const oDate = o.date ? new Date(o.date) : null;
                if (!oDate || isNaN(oDate)) return false;
                if (from && oDate < from) return false;
                if (to && oDate > to) return false;
                return true;
            });
        }
        return list.length;
    }

    try {
        const db = window.firebaseDb;
        const ordersCol = collection(db, 'orders');
        const cleanSearch = searchQ.trim();

        if (cleanSearch && (cleanSearch.length >= 15 || cleanSearch.startsWith('MOCK-'))) {
            const docRef = doc(db, 'orders', cleanSearch);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? 1 : 0;
        }

        let constraints = [];
        if (cleanSearch) {
            if (/^\d+$/.test(cleanSearch)) {
                constraints.push(where('customerMobile', '>=', cleanSearch));
                constraints.push(where('customerMobile', '<=', cleanSearch + '\uf8ff'));
            } else if (cleanSearch.includes('@')) {
                const emailLower = cleanSearch.toLowerCase();
                constraints.push(where('customerEmail', '>=', emailLower));
                constraints.push(where('customerEmail', '<=', emailLower + '\uf8ff'));
            } else {
                constraints.push(where('customer', '>=', cleanSearch));
                constraints.push(where('customer', '<=', cleanSearch + '\uf8ff'));
            }
        } else if (dateFrom || dateTo) {
            if (dateFrom) {
                constraints.push(where('createdAt', '>=', dateFrom.toISOString()));
            }
            if (dateTo) {
                constraints.push(where('createdAt', '<=', dateTo.toISOString()));
            }
        }

        const q = query(ordersCol, ...constraints);
        const snap = await getAggregateFromServer(q, { count: count() });
        return snap.data().count;
    } catch (err) {
        console.error("Firestore dbGetOrdersCount error:", err);
        return 0;
    }
}

async function dbGetOrdersStats() {
    if (isMock()) {
        const orders = JSON.parse(localStorage.getItem('gymbroMockOrders') || '[]');
        const total = orders.length;
        const pending = orders.filter(o => o.status === 'pending').length;
        const processing = orders.filter(o => o.status === 'processing').length;
        const shipped = orders.filter(o => o.status === 'shipped').length;
        const delivered = orders.filter(o => o.status === 'delivered').length;
        const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        return { total, pending, processing, shipped, delivered, revenue };
    }

    try {
        const db = window.firebaseDb;
        const ordersCol = collection(db, 'orders');

        const [totalSnap, pendingSnap, processingSnap, shippedSnap, deliveredSnap, revenueSnap] = await Promise.all([
            getAggregateFromServer(ordersCol, { count: count() }),
            getAggregateFromServer(query(ordersCol, where('status', '==', 'pending')), { count: count() }),
            getAggregateFromServer(query(ordersCol, where('status', '==', 'processing')), { count: count() }),
            getAggregateFromServer(query(ordersCol, where('status', '==', 'shipped')), { count: count() }),
            getAggregateFromServer(query(ordersCol, where('status', '==', 'delivered')), { count: count() }),
            getAggregateFromServer(ordersCol, { sum: sum('total') })
        ]);

        return {
            total: totalSnap.data().count,
            pending: pendingSnap.data().count,
            processing: processingSnap.data().count,
            shipped: shippedSnap.data().count,
            delivered: deliveredSnap.data().count,
            revenue: revenueSnap.data().sum || 0
        };
    } catch (err) {
        console.error("Firestore dbGetOrdersStats error:", err);
        throw err;
    }
}

async function dbUpdateOrderStatus(orderId, status) {
    if (isMock()) {
        console.log(`Mock DB: Updating order ${orderId} to status: ${status}`);
        let orders = JSON.parse(localStorage.getItem('gymbroMockOrders') || '[]');
        orders = orders.map(o => (o.id === orderId || o._id === orderId) ? { ...o, status } : o);
        localStorage.setItem('gymbroMockOrders', JSON.stringify(orders));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'orders', orderId);
        await updateDoc(docRef, { status });
        console.log(`Firestore: Updated order ${orderId} to status: ${status}`);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbUpdateOrderStatus error:", err);
        throw err;
    }
}

async function dbDeleteOrder(orderId) {
    if (isMock()) {
        console.log(`Mock DB: Deleting order ${orderId}`);
        let orders = JSON.parse(localStorage.getItem('gymbroMockOrders') || '[]');
        orders = orders.filter(o => o.id !== orderId && o._id !== orderId);
        localStorage.setItem('gymbroMockOrders', JSON.stringify(orders));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'orders', orderId);
        await deleteDoc(docRef);
        console.log(`Firestore: Deleted order ${orderId}`);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbDeleteOrder error:", err);
        throw err;
    }
}

// ----------------------------------------------------
// 3. REVIEWS DB METHODS
// ----------------------------------------------------
async function dbGetReviews() {
    if (isMock()) {
        console.log("Mock DB: Fetching reviews locally.");
        const reviews = JSON.parse(localStorage.getItem('gymbroMockReviews') || '[]');
        return reviews;
    }

    try {
        const db = window.firebaseDb;
        const reviewsCol = collection(db, 'reviews');
        const q = query(reviewsCol, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        let list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });
        return list;
    } catch (err) {
        console.error("Firestore dbGetReviews error:", err);
        throw err;
    }
}

async function dbAddReview(reviewData) {
    if (isMock()) {
        console.log("Mock DB: Adding review locally.");
        let reviews = JSON.parse(localStorage.getItem('gymbroMockReviews') || '[]');
        const newReview = {
            id: 'MOCK-REV-' + Date.now(),
            ...reviewData,
            createdAt: new Date().toISOString()
        };
        reviews.unshift(newReview);
        localStorage.setItem('gymbroMockReviews', JSON.stringify(reviews));
        return { ok: true, review: newReview };
    }

    try {
        const db = window.firebaseDb;
        const reviewsCol = collection(db, 'reviews');
        const reviewDoc = {
            ...reviewData,
            createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(reviewsCol, reviewDoc);
        return { ok: true, review: { id: docRef.id, ...reviewDoc } };
    } catch (err) {
        console.error("Firestore dbAddReview error:", err);
        throw err;
    }
}

async function dbDeleteReview(reviewId) {
    if (isMock()) {
        console.log(`Mock DB: Deleting review ${reviewId}`);
        let reviews = JSON.parse(localStorage.getItem('gymbroMockReviews') || '[]');
        reviews = reviews.filter(r => r.id !== reviewId);
        localStorage.setItem('gymbroMockReviews', JSON.stringify(reviews));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'reviews', reviewId);
        await deleteDoc(docRef);
        console.log(`Firestore: Deleted review ${reviewId}`);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbDeleteReview error:", err);
        throw err;
    }
}

async function dbUpdateReview(reviewId, updateData) {
    if (isMock()) {
        console.log(`Mock DB: Updating review ${reviewId}`);
        let reviews = JSON.parse(localStorage.getItem('gymbroMockReviews') || '[]');
        reviews = reviews.map(r => r.id === reviewId ? { ...r, ...updateData } : r);
        localStorage.setItem('gymbroMockReviews', JSON.stringify(reviews));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'reviews', reviewId);
        await updateDoc(docRef, updateData);
        console.log(`Firestore: Updated review ${reviewId}`);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbUpdateReview error:", err);
        throw err;
    }
}

// ----------------------------------------------------
// 4. NEWSLETTER SUBSCRIBERS DB METHODS
// ----------------------------------------------------
let mockSubscribersCallbacks = [];

function triggerMockSubscribersUpdate() {
    let subs = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');
    mockSubscribersCallbacks.forEach(cb => {
        if (typeof cb === 'function') {
            cb({ ok: true, subscribers: subs });
        }
    });
}

async function dbAddSubscriber(email) {
    if (!email) throw new Error("Email is required.");
    const normalizedEmail = email.toLowerCase().trim();

    if (isMock()) {
        console.log("Mock DB: Adding subscriber locally:", normalizedEmail);
        let subs = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');
        const existing = subs.find(s => s.email === normalizedEmail);
        if (existing) {
            throw new Error("You are already subscribed!");
        }
        const newSub = {
            email: normalizedEmail,
            subscribedAt: new Date().toISOString(),
            source: "Bro Squad",
            status: "active"
        };
        subs.unshift(newSub);
        localStorage.setItem('gymbroMockSubscribers', JSON.stringify(subs));
        triggerMockSubscribersUpdate();
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const subDocRef = doc(db, 'newsletter_subscribers', normalizedEmail);
        const subDoc = await getDoc(subDocRef);
        if (subDoc.exists()) {
            throw new Error("You are already subscribed!");
        }

        const payload = {
            email: normalizedEmail,
            subscribedAt: serverTimestamp(),
            source: "Bro Squad",
            status: "active"
        };

        await setDoc(subDocRef, payload);
        console.log("Newsletter subscriber added:", normalizedEmail);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbAddSubscriber error:", err);
        throw err;
    }
}

async function dbDeleteSubscriber(email) {
    if (!email) throw new Error("Email is required.");
    const normalizedEmail = email.toLowerCase().trim();

    if (isMock()) {
        console.log("Mock DB: Deleting subscriber:", normalizedEmail);
        let subs = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');
        subs = subs.filter(s => s.email !== normalizedEmail);
        localStorage.setItem('gymbroMockSubscribers', JSON.stringify(subs));
        triggerMockSubscribersUpdate();
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const subDocRef = doc(db, 'newsletter_subscribers', normalizedEmail);
        await deleteDoc(subDocRef);
        console.log("Newsletter subscriber deleted:", normalizedEmail);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbDeleteSubscriber error:", err);
        throw err;
    }
}

function dbGetSubscribersListener(callback) {
    if (isMock()) {
        console.log("Mock DB: Registering real-time subscribers listener.");
        mockSubscribersCallbacks.push(callback);
        // Initial trigger
        let subs = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');
        callback({ ok: true, subscribers: subs });
        
        return () => {
            mockSubscribersCallbacks = mockSubscribersCallbacks.filter(cb => cb !== callback);
        };
    }

    try {
        const db = window.firebaseDb;
        const subsCol = collection(db, 'newsletter_subscribers');
        // Removed hardcoded limit(200) cap as per requirements
        const q = query(subsCol, orderBy('subscribedAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            let list = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let dateStr = "";
                if (data.subscribedAt && typeof data.subscribedAt.toDate === 'function') {
                    dateStr = data.subscribedAt.toDate().toISOString();
                } else if (data.subscribedAt) {
                    dateStr = String(data.subscribedAt);
                }
                list.push({ 
                    id: doc.id, 
                    email: data.email,
                    subscribedAt: dateStr,
                    source: data.source || 'Bro Squad',
                    status: data.status || 'active'
                });
            });
            callback({ ok: true, subscribers: list });
        }, (err) => {
            console.error("Firestore onSnapshot error:", err);
            callback({ ok: false, error: err });
        });
        
        return unsubscribe;
    } catch (err) {
        console.error("Firestore dbGetSubscribersListener setup error:", err);
        throw err;
    }
}

async function dbGetSubscribers(options = {}) {
    const { pageSize = 50, startAfterDoc = null, searchQ = '', noLimit = false } = options;

    if (isMock()) {
        console.log("Mock DB: Fetching subscribers locally with pagination.");
        let list = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');

        if (searchQ) {
            const sq = searchQ.toLowerCase().trim();
            list = list.filter(s => (s.email || '').toLowerCase().includes(sq));
        }

        list.sort((a, b) => new Date(b.subscribedAt || 0) - new Date(a.subscribedAt || 0));

        let pageItems = list;
        let lastDoc = null;
        if (!noLimit) {
            let startIndex = 0;
            if (startAfterDoc) {
                const idx = list.findIndex(s => s.email === startAfterDoc);
                if (idx !== -1) {
                    startIndex = idx + 1;
                }
            }
            pageItems = list.slice(startIndex, startIndex + pageSize);
            lastDoc = pageItems.length > 0 ? pageItems[pageItems.length - 1].email : null;
        }

        return { ok: true, subscribers: pageItems, lastDoc };
    }

    try {
        const db = window.firebaseDb;
        const subsCol = collection(db, 'newsletter_subscribers');
        let constraints = [];
        const cleanSearch = searchQ.toLowerCase().trim();

        if (cleanSearch) {
            constraints.push(where('email', '>=', cleanSearch));
            constraints.push(where('email', '<=', cleanSearch + '\uf8ff'));
            constraints.push(orderBy('email'));
        } else {
            constraints.push(orderBy('subscribedAt', 'desc'));
        }

        if (startAfterDoc && !noLimit) {
            constraints.push(startAfter(startAfterDoc));
        }

        if (!noLimit) {
            constraints.push(limit(pageSize));
        }

        const q = query(subsCol, ...constraints);
        const querySnapshot = await getDocs(q);
        let list = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let dateStr = "";
            if (data.subscribedAt && typeof data.subscribedAt.toDate === 'function') {
                dateStr = data.subscribedAt.toDate().toISOString();
            } else if (data.subscribedAt) {
                dateStr = String(data.subscribedAt);
            }
            list.push({
                id: doc.id,
                email: data.email,
                subscribedAt: dateStr,
                source: data.source || 'Bro Squad',
                status: data.status || 'active'
            });
        });

        const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
        return { ok: true, subscribers: list, lastDoc };
    } catch (err) {
        console.error("Firestore dbGetSubscribers error:", err);
        throw err;
    }
}

async function dbGetSubscribersCount(options = {}) {
    const { searchQ = '' } = options;

    if (isMock()) {
        let list = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');
        if (searchQ) {
            const sq = searchQ.toLowerCase().trim();
            list = list.filter(s => (s.email || '').toLowerCase().includes(sq));
        }
        return list.length;
    }

    try {
        const db = window.firebaseDb;
        const subsCol = collection(db, 'newsletter_subscribers');
        let constraints = [];
        const cleanSearch = searchQ.toLowerCase().trim();

        if (cleanSearch) {
            constraints.push(where('email', '>=', cleanSearch));
            constraints.push(where('email', '<=', cleanSearch + '\uf8ff'));
        }

        const q = query(subsCol, ...constraints);
        const snap = await getAggregateFromServer(q, { count: count() });
        return snap.data().count;
    } catch (err) {
        console.error("Firestore dbGetSubscribersCount error:", err);
        return 0;
    }
}

async function dbGetSubscribersStats() {
    if (isMock()) {
        const subs = JSON.parse(localStorage.getItem('gymbroMockSubscribers') || '[]');
        return { total: subs.length };
    }

    try {
        const db = window.firebaseDb;
        const subsCol = collection(db, 'newsletter_subscribers');
        const snap = await getAggregateFromServer(subsCol, { count: count() });
        return { total: snap.data().count };
    } catch (err) {
        console.error("Firestore dbGetSubscribersStats error:", err);
        throw err;
    }
}

// ----------------------------------------------------
// 5. COLLECTIONS DB METHODS
// ----------------------------------------------------
async function dbGetCollections() {
    if (isMock()) {
        console.log("Mock DB: Fetching collections locally.");
        let collections = JSON.parse(localStorage.getItem('gymbroMockCollections') || '[]');
        if (collections.length === 0) {
            // Seed defaults
            collections = [
                { id: 'hoodies', name: 'Hoodies', image: 'images/gym-bro-hoodie.webp' },
                { id: 'oversized', name: 'Oversized Tees', image: 'images/oversized-gym-tshirt.webp' },
                { id: 'trackpants', name: 'Track Pants', image: 'images/track-pants.jpg' },
                { id: 'accessories', name: 'Accessories', image: 'images/lifting-straps.jpg' }
            ];
            localStorage.setItem('gymbroMockCollections', JSON.stringify(collections));
        }
        // Sort alphabetically by name
        collections.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return collections;
    }

    try {
        const db = window.firebaseDb;
        const colRef = collection(db, 'collections');
        const q = query(colRef, orderBy('name'));
        const querySnapshot = await getDocs(q);
        let list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });

        if (list.length === 0) {
            // Seed defaults
            const defaults = [
                { id: 'hoodies', name: 'Hoodies', image: 'images/gym-bro-hoodie.webp' },
                { id: 'oversized', name: 'Oversized Tees', image: 'images/oversized-gym-tshirt.webp' },
                { id: 'trackpants', name: 'Track Pants', image: 'images/track-pants.jpg' },
                { id: 'accessories', name: 'Accessories', image: 'images/lifting-straps.jpg' }
            ];
            const batch = writeBatch(db);
            for (const d of defaults) {
                const docRef = doc(colRef, d.id);
                batch.set(docRef, { name: d.name, image: d.image });
            }
            await batch.commit();
            
            // Re-fetch
            const freshSnapshot = await getDocs(q);
            freshSnapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
        }
        return list;
    } catch (err) {
        console.error("Firestore dbGetCollections error:", err);
        throw err;
    }
}

async function dbAddCollection(colData) {
    if (!colData.name || !colData.image) throw new Error("Name and image are required.");
    const slug = colData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) throw new Error("Invalid collection name.");

    if (isMock()) {
        let collections = JSON.parse(localStorage.getItem('gymbroMockCollections') || '[]');
        if (collections.some(c => c.id === slug)) throw new Error("Collection slug already exists.");
        const newCol = { id: slug, name: colData.name, image: colData.image };
        collections.push(newCol);
        localStorage.setItem('gymbroMockCollections', JSON.stringify(collections));
        return { ok: true, collection: newCol };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'collections', slug);
        const snap = await getDoc(docRef);
        if (snap.exists()) throw new Error("Collection slug already exists.");
        await setDoc(docRef, { name: colData.name, image: colData.image });
        return { ok: true, collection: { id: slug, name: colData.name, image: colData.image } };
    } catch (err) {
        console.error("Firestore dbAddCollection error:", err);
        throw err;
    }
}

async function dbUpdateCollection(colId, colData) {
    if (isMock()) {
        let collections = JSON.parse(localStorage.getItem('gymbroMockCollections') || '[]');
        collections = collections.map(c => c.id === colId ? { ...c, ...colData } : c);
        localStorage.setItem('gymbroMockCollections', JSON.stringify(collections));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'collections', colId);
        await updateDoc(docRef, colData);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbUpdateCollection error:", err);
        throw err;
    }
}

async function dbDeleteCollection(colId) {
    if (isMock()) {
        let collections = JSON.parse(localStorage.getItem('gymbroMockCollections') || '[]');
        collections = collections.filter(c => c.id !== colId);
        localStorage.setItem('gymbroMockCollections', JSON.stringify(collections));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const docRef = doc(db, 'collections', colId);
        await deleteDoc(docRef);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbDeleteCollection error:", err);
        throw err;
    }
}

async function dbRenameProductCategory(oldCat, newCat) {
    if (!oldCat || !newCat) throw new Error("Old and new category names are required.");
    const normalizedOld = oldCat.toLowerCase().trim();
    const normalizedNew = newCat.toLowerCase().trim();

    if (isMock()) {
        console.log(`Mock DB: Renaming product category from "${normalizedOld}" to "${normalizedNew}"`);
        let products = JSON.parse(localStorage.getItem('gymbroMockProducts') || '[]');
        products = products.map(p => {
            if (p.category && p.category.toLowerCase().trim() === normalizedOld) {
                return { ...p, category: normalizedNew };
            }
            return p;
        });
        localStorage.setItem('gymbroMockProducts', JSON.stringify(products));
        return { ok: true };
    }

    try {
        const db = window.firebaseDb;
        const productsCol = collection(db, 'products');
        const q = query(productsCol, where('category', '==', normalizedOld));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log("No products found with category:", normalizedOld);
            return { ok: true };
        }

        const batch = writeBatch(db);
        snap.forEach((doc) => {
            batch.update(doc.ref, { category: normalizedNew });
        });
        await batch.commit();
        console.log(`Firestore: Successfully renamed category from "${normalizedOld}" to "${normalizedNew}" for ${snap.size} products.`);
        return { ok: true };
    } catch (err) {
        console.error("Firestore dbRenameProductCategory error:", err);
        throw err;
    }
}

// Bind all methods to global scope
window.dbGetProducts = dbGetProducts;
window.dbSeedProducts = dbSeedProducts;
window.dbAddProduct = dbAddProduct;
window.dbDeleteProduct = dbDeleteProduct;
window.dbAddOrder = dbAddOrder;
window.dbGetOrders = dbGetOrders;
window.dbUpdateOrderStatus = dbUpdateOrderStatus;
window.dbDeleteOrder = dbDeleteOrder;
window.dbGetReviews = dbGetReviews;
window.dbAddReview = dbAddReview;
window.dbDeleteReview = dbDeleteReview;
window.dbUpdateReview = dbUpdateReview;
window.dbAddSubscriber = dbAddSubscriber;
window.dbDeleteSubscriber = dbDeleteSubscriber;
window.dbGetSubscribersListener = dbGetSubscribersListener;
window.dbGetSubscribers = dbGetSubscribers;
window.dbGetOrdersCount = dbGetOrdersCount;
window.dbGetOrdersStats = dbGetOrdersStats;
window.dbGetSubscribersCount = dbGetSubscribersCount;
window.dbGetSubscribersStats = dbGetSubscribersStats;
window.dbGetCollections = dbGetCollections;
window.dbAddCollection = dbAddCollection;
window.dbUpdateCollection = dbUpdateCollection;
window.dbDeleteCollection = dbDeleteCollection;
window.dbRenameProductCategory = dbRenameProductCategory;
