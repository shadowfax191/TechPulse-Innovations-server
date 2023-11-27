// eEiNbFqmSAQoItYA
// employee-management
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE)
const app = express()
const port = process.env.PORT || 5000

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}))

app.use(express.json());
app.use(cookieParser())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.ch5al24.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {

        const UsersCollection = client.db('employeeDB').collection('users')
        const FireCollection = client.db('employeeDB').collection('fires')
        const WorkCollection = client.db('employeeDB').collection('work')
        const PaymentCollection = client.db('employeeDB').collection('payment')



       

        //payment
        app.post('/create-payment'), async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        }

        const verifyToken = async (req, res, next) => {
            const token = req.cookies?.token
            if (!token) {
                return res.status(401).send({ message: 'not Authorized' })
            }
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'not Authorized' })
                }
                req.user = decoded

                next()
            })
        }
        const verifyAdmin = async (req, res, next) => {
            const email = req.user.userInfo.email

            const query = { email: email };
            const user = await UsersCollection.findOne(query)
            const isAdmin = user?.role == 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'not Authorized' })
            }

            next()
        }

        const verifyHr = async (req, res, next) => {
            const email = req.user.userInfo.email

            const query = { email: email };
            const user = await UsersCollection.findOne(query)
            const ishR = user?.role == 'HR'
            if (!ishR) {
                return res.status(403).send({ message: 'not Authorized' })
            }

            next()
        }




        // const verifyEmployee = async (req, res, next) => {
        //     const email = req.user.userInfo.email

        //     const query = { email: email };
        //     const user = await UsersCollection.findOne(query)
        //     const isEmployee = user?.role == 'employee'
        //     if (!isEmployee) {
        //         return res.status(403).send({ message: 'not Authorized' })
        //     }

        //     next()
        // }

        //users collection 

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await UsersCollection.insertOne(user)
            res.send(result)
        })

        // HR verify

        app.get('/user/hr/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await UsersCollection.findOne(query);
            let isHr = false;
            if (user) {
                isHr = user?.role === 'HR'
            }

            res.send({ isHr })
        })

        // Employee verify

        app.get('/user/employee/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await UsersCollection.findOne(query);
            let isEmployee = false;
            if (user) {
                isEmployee = user?.role === 'employee'
            }

            res.send({ isEmployee })
        })

        // Admin Verify 

        app.get('/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await UsersCollection.findOne(query);
            let isAdmin = false;
            if (user) {
                isAdmin = user?.role === 'admin'
            }

            res.send({ isAdmin })
        })



        // HR
        app.get('/users', verifyToken, verifyHr, async (req, res) => {
            const result = await UsersCollection.find().toArray()
            res.send(result)
        })

        app.post('/payment', verifyToken, verifyHr,async (req, res) => {
            const user = req.body
            const {email,month,year}=req.body

            const existingPayment= await PaymentCollection.findOne({email,month,year})

            if(existingPayment){
                return res.er('already paid in this month')
            }


            const result = await PaymentCollection.insertOne(user)
            res.send(result)
        })
        app.get('/payment',  verifyToken, verifyHr, async (req, res) => {
            const result = await PaymentCollection.find().toArray()
            res.send(result)
        })

        // admin
        app.get('/allEmployee', verifyToken, verifyAdmin, async (req, res) => {
            const result = await UsersCollection.find().toArray()
            res.send(result)
        })

        app.get('/employee/:email', verifyToken, verifyHr, async (req, res) => {
            const email = req.params.email
       
            const filter = {
                email: email
            }
            const user = await UsersCollection.findOne(filter);
            res.send(user)
        })
        app.get('/payment/:email', verifyToken, verifyHr, async (req, res) => {
            const email = req.params.email
           
            const filter = {
                email: email
            }
            const user = await PaymentCollection.find(filter).toArray()
            res.send(user)
        })


        // HR/
        app.put('/users/update/:id', verifyToken, verifyHr, async (req, res) => {
            const data = req.body
            const id = req.params.id
            const filter = {
                _id: new ObjectId(id)
            }
            const options = { upsert: true }
            const updateData = {
                $set: {
                    verified: data.verify
                }
            }
            const result = await UsersCollection.updateOne(
                filter,
                updateData,
                options
            )
            res.send(result)
        })



        // admin
        app.put('/makeHr/update/:id', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body
            const id = req.params.id
            const filter = {
                _id: new ObjectId(id)
            }
            const options = { upsert: true }
            const updateData = {
                $set: {
                    role: data.HR
                }
            }
            const result = await UsersCollection.updateOne(
                filter,
                updateData,
                options
            )
            res.send(result)
        })


        app.post('/fire', verifyToken, verifyAdmin, async (req, res) => {
            const user = req.body
            const result = await FireCollection.insertOne(user)
            res.send(result)
        })

        app.get('/fire', async (req, res) => {

            const result = await FireCollection.find().toArray()
            res.send(result)
        })

        //employee
        app.post('/work', verifyToken, async (req, res) => {
            const data = req.body
            const result = await WorkCollection.insertOne(data)
            res.send(result)
        })
        app.get('/work', async (req, res) => {

            const result = await WorkCollection.find().toArray()
            res.send(result)
        })


        //jwt Auth

        app.post('/jwt', async (req, res) => {
            const user = req.body

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '48h' })

            res.
                cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                })
                .send({ success: true })

        })







     


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);







app.get('/', (req, res) => {
    res.send('server running')
})

app.listen(port, () => {
    console.log(`server is running on port: ${port}`);
})