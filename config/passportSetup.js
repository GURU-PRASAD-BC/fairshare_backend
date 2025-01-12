const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

passport.serializeUser((user, done) => done(null, user.userID));
passport.deserializeUser(async (userID, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { userID } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});  //fetch the user from the database during deserialization

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://192.168.0.127.nip.io:8080/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await prisma.user.findUnique({ where: { email: profile.emails[0].value } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    image: profile.photos[0].value,
                    password: "google-oauth-user",
                },
            });
        }
        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));


//callbackURL: "http://192.168.0.127:8080/auth/google/callback",
