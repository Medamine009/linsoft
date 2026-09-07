// Reprise des avis anterieurs a l'ajout du champ userName.
//
// Les avis deposes avant cette evolution ne portent que l'identifiant Keycloak
// de leur auteur : l'interface n'avait alors qu'une chaine technique a afficher.
// Le nom lisible existe deja dans registration_db (attendeeName, denormalise a
// l'inscription) : on s'en sert pour completer les avis, sans rien inventer.
//
// Execution : docker exec eventify-mongo mongosh --quiet --file /tmp/backfill.js

const rgDb = db.getSiblingDB('registration_db');
const fbDb = db.getSiblingDB('feedback_db');

// Table identifiant -> nom, construite depuis les inscriptions.
const noms = {};
rgDb.registrations.find({ attendeeId: { $ne: null }, attendeeName: { $ne: null } })
    .forEach(r => { if (r.attendeeName) noms[r.attendeeId] = r.attendeeName; });

let completes = 0;
let inconnus = 0;

fbDb.feedbacks.find({ $or: [{ userName: { $exists: false } }, { userName: null }, { userName: '' }] })
    .forEach(f => {
        const nom = noms[f.userId];
        if (nom) {
            fbDb.feedbacks.updateOne({ _id: f._id }, { $set: { userName: nom } });
            completes++;
        } else {
            inconnus++;
        }
    });

print('avis completes = ' + completes);
print('auteurs introuvables = ' + inconnus);
print('total avis = ' + fbDb.feedbacks.countDocuments());
